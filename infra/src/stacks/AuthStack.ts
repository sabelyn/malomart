import { completeGoogleSignIn } from "@mm/lib";
import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import {
  AccountRecovery,
  FeaturePlan,
  LambdaVersion,
  OAuthScope,
  ProviderAttribute,
  ResourceServerScope,
  UserPool,
  UserPoolClient,
  UserPoolClientIdentityProvider,
  UserPoolEmail,
  UserPoolIdentityProviderGoogle,
  UserPoolOperation
} from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Secret } from "aws-cdk-lib/aws-secretsmanager";
import type { Construct } from "constructs";

import { createFunction } from "../helpers";
import type { DbStack } from "./DbStack";
import type { SiteDomain } from "./FrontendStack";

export type GoogleAuthConfig = {
  authDomain: SiteDomain;
  secretName: string;
};

type Props = StackProps & {
  dbStack: DbStack;
  appOrigin: string;
  localDevOrigin?: string;
  emailDomain?: string;
  googleAuth?: GoogleAuthConfig;
};

const ADMIN_GROUP = "admin";
const CUSTOMER_GROUP = "customer";
const RESOURCE_SERVER_ID = "malomart";

export class AuthStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly adminScope: string;
  public readonly cookieAuthorizerFunction: NodejsFunction;
  public readonly oauthDomain?: string;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    this.userPool = new UserPool(this, "UserPool", {
      featurePlan: FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: false },
      signInCaseSensitive: false,
      signInPolicy: {
        allowedFirstAuthFactors: { password: true, emailOtp: true }
      },
      accountRecovery: AccountRecovery.EMAIL_ONLY,
      keepOriginal: { email: true },
      email: props.emailDomain
        ? UserPoolEmail.withSES({
            fromEmail: `noreply@${props.emailDomain}`,
            fromName: "Malo Mart",
            sesVerifiedDomain: props.emailDomain,
            sesRegion: this.region
          })
        : undefined,
      standardAttributes: {
        email: { required: true },
        fullname: { required: true }
      }
    });

    this.userPool.addGroup("AdminGroup", { groupName: ADMIN_GROUP, precedence: 0 });
    this.userPool.addGroup("CustomerGroup", { groupName: CUSTOMER_GROUP, precedence: 10 });

    const adminScope = new ResourceServerScope({
      scopeName: "admin",
      scopeDescription: "Manage the product catalog and orders"
    });
    this.userPool.addResourceServer("ResourceServer", {
      identifier: RESOURCE_SERVER_ID,
      scopes: [adminScope]
    });
    this.adminScope = `${RESOURCE_SERVER_ID}/${adminScope.scopeName}`;

    const googleProvider = props.googleAuth && this.addGoogleProvider(props.googleAuth);
    this.oauthDomain = props.googleAuth && `https://${props.googleAuth.authDomain.hostName}`;

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: true,
      authFlows: { user: true },
      ...(googleProvider
        ? {
            oAuth: {
              flows: { authorizationCodeGrant: true },
              scopes: [OAuthScope.OPENID, OAuthScope.EMAIL, OAuthScope.PROFILE, OAuthScope.COGNITO_ADMIN],
              callbackUrls: [props.appOrigin, ...(props.localDevOrigin ? [props.localDevOrigin] : [])].map(
                origin => `${origin}${completeGoogleSignIn.fullPath}`
              )
            },
            supportedIdentityProviders: [UserPoolClientIdentityProvider.GOOGLE]
          }
        : { disableOAuth: true }),
      preventUserExistenceErrors: true,
      accessTokenValidity: Duration.minutes(15),
      idTokenValidity: Duration.minutes(15),
      refreshTokenValidity: Duration.days(30),
      refreshTokenRotationGracePeriod: Duration.seconds(20),
      authSessionValidity: Duration.minutes(10)
    });
    if (googleProvider) {
      this.userPoolClient.node.addDependency(googleProvider);
    }

    const preTokenGeneration = createFunction(this, "PreTokenGeneration", "preTokenGeneration", {
      environment: {
        ADMIN_GROUP,
        ADMIN_SCOPE: this.adminScope
      }
    });
    this.userPool.addTrigger(UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG, preTokenGeneration, LambdaVersion.V2_0);

    const { customers } = props.dbStack.tables;
    const postConfirmation = createFunction(this, "PostConfirmation", "postConfirmation", {
      environment: {
        CUSTOMER_GROUP,
        CUSTOMERS_TABLE_NAME: customers.tableName
      }
    });
    customers.grants.writeData(postConfirmation);
    postConfirmation.addToRolePolicy(
      new PolicyStatement({
        actions: ["cognito-idp:AdminAddUserToGroup"],
        resources: [this.formatArn({ service: "cognito-idp", resource: "userpool", resourceName: "*" })]
      })
    );
    this.userPool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmation);

    const preSignUp = createFunction(this, "PreSignUp", "preSignUp");
    preSignUp.addToRolePolicy(
      new PolicyStatement({
        actions: ["cognito-idp:ListUsers", "cognito-idp:AdminLinkProviderForUser"],
        resources: [this.formatArn({ service: "cognito-idp", resource: "userpool", resourceName: "*" })]
      })
    );
    this.userPool.addTrigger(UserPoolOperation.PRE_SIGN_UP, preSignUp);

    this.cookieAuthorizerFunction = createFunction(this, "CookieAuthorizer", "cookieAuthorizer", {
      environment: {
        USER_POOL_ID: this.userPool.userPoolId,
        USER_POOL_CLIENT_ID: this.userPoolClient.userPoolClientId
      }
    });

    new CfnOutput(this, "UserPoolId", { value: this.userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, "AdminScope", { value: this.adminScope });
    if (this.oauthDomain) {
      new CfnOutput(this, "OAuthDomain", { value: this.oauthDomain });
    }
  }

  private addGoogleProvider({ secretName }: GoogleAuthConfig) {
    const secret = Secret.fromSecretNameV2(this, "GoogleOAuthSecret", secretName);
    return new UserPoolIdentityProviderGoogle(this, "Google", {
      userPool: this.userPool,
      clientId: secret.secretValueFromJson("clientId").unsafeUnwrap(),
      clientSecretValue: secret.secretValueFromJson("clientSecret"),
      scopes: ["openid", "email", "profile"],
      attributeMapping: {
        email: ProviderAttribute.GOOGLE_EMAIL,
        emailVerified: ProviderAttribute.GOOGLE_EMAIL_VERIFIED,
        fullname: ProviderAttribute.GOOGLE_NAME
      }
    });
  }
}
