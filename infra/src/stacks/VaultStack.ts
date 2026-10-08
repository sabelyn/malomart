import type { StackProps } from "aws-cdk-lib";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { HttpMethod, HttpRoute, HttpRouteKey } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Key } from "aws-cdk-lib/aws-kms";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { resolve } from "path";
import { tokenizeCard } from "@mm/lib/lambdas";

import type { AuthStack } from "./AuthStack";
import type { GatewayStack } from "./GatewayStack";

type Props = StackProps & {
  authStack: AuthStack;
  gatewayStack: GatewayStack;
};

export class VaultStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const cardKey = new Key(this, "CardKey", {
      description: "Encrypts card numbers stored in the vault",
      enableKeyRotation: true,
      removalPolicy: RemovalPolicy.DESTROY,
      pendingWindow: Duration.days(7)
    });

    const cardTable = new Table(this, "CardTable", {
      partitionKey: { name: "token", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });

    const tokenizer = new NodejsFunction(this, "TokenizerFunction", {
      entry: resolve(__dirname, "../lambdas/vaultTokenizer.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(10),
      logGroup: new LogGroup(this, "TokenizerLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName,
        VAULT_KEY_ID: cardKey.keyArn
      }
    });
    cardTable.grant(tokenizer, "dynamodb:PutItem");
    cardKey.grant(tokenizer, "kms:Encrypt");

    const authorizer = new HttpLambdaAuthorizer("VaultCookieAuthorizer", props.authStack.cookieAuthorizerFunction, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: [],
      resultsCacheTtl: Duration.seconds(0)
    });

    const { httpApi } = props.gatewayStack;
    new HttpRoute(this, "TokenizerRoute", {
      httpApi,
      routeKey: HttpRouteKey.with(tokenizeCard.fullPath, tokenizeCard.method as HttpMethod),
      integration: new HttpLambdaIntegration("TokenizerIntegration", tokenizer),
      authorizer
    });
  }
}
