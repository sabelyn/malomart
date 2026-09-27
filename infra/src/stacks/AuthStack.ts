import { Stack } from "aws-cdk-lib";
import {
  FeaturePlan,
  LambdaVersion,
  ResourceServerScope,
  UserPool,
  UserPoolClient,
  UserPoolOperation
} from "aws-cdk-lib/aws-cognito";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import path from "node:path";

const ADMIN_GROUP = "admin";
const CUSTOMER_GROUP = "customer";
const RESOURCE_SERVER_ID = "malomart";

export class AuthStack extends Stack {
  public readonly userPool: UserPool;
  public readonly userPoolClient: UserPoolClient;
  public readonly adminScope: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.userPool = new UserPool(this, "UserPool", {
      featurePlan: FeaturePlan.ESSENTIALS,
      selfSignUpEnabled: true,
      signInAliases: { email: true, username: false },
      keepOriginal: { email: true },
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

    this.userPoolClient = this.userPool.addClient("WebClient", {
      generateSecret: false,
      authFlows: { user: true, userSrp: true }
    });

    const preTokenGeneration = new NodejsFunction(this, "PreTokenGeneration", {
      entry: path.resolve(__dirname, "../lambdas/preTokenGeneration.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      environment: {
        ADMIN_GROUP,
        ADMIN_SCOPE: this.adminScope
      }
    });
    this.userPool.addTrigger(UserPoolOperation.PRE_TOKEN_GENERATION_CONFIG, preTokenGeneration, LambdaVersion.V2_0);

    const postConfirmation = new NodejsFunction(this, "PostConfirmation", {
      entry: path.resolve(__dirname, "../lambdas/postConfirmation.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      environment: {
        CUSTOMER_GROUP
      }
    });
    postConfirmation.addToRolePolicy(
      new PolicyStatement({
        actions: ["cognito-idp:AdminAddUserToGroup"],
        resources: [this.formatArn({ service: "cognito-idp", resource: "userpool", resourceName: "*" })]
      })
    );
    this.userPool.addTrigger(UserPoolOperation.POST_CONFIRMATION, postConfirmation);
  }
}
