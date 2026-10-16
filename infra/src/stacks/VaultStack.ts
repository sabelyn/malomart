import type { InvokeFunctionNames } from "@mm/clients/lambda";
import { tokenizeCard } from "@mm/lib/lambdas";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { HttpMethod, HttpRoute, HttpRouteKey } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Key } from "aws-cdk-lib/aws-kms";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { resolve } from "path";

import { FailureQueue } from "../constructs/FailureQueue";
import type { AlertsStack } from "./AlertsStack";
import type { AuthStack } from "./AuthStack";
import type { GatewayStack } from "./GatewayStack";

type Props = StackProps & {
  alertsStack: AlertsStack;
  authStack: AuthStack;
  gatewayStack: GatewayStack;
};

export class VaultStack extends Stack {
  public readonly invokeFunctions: Record<keyof InvokeFunctionNames, NodejsFunction>;
  public readonly chargeCardFunction: NodejsFunction;

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
      entry: resolve(__dirname, "../lambdas/vaultCardTokenizer.ts"),
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

    const describeCard = new NodejsFunction(this, "DescribeCardFunction", {
      entry: resolve(__dirname, "../lambdas/vaultDescribeCard.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      logGroup: new LogGroup(this, "DescribeCardLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(describeCard, "dynamodb:GetItem");

    const deleteCardFailures = new FailureQueue(this, "DeleteCardFailures", {
      description: "Async card deletions failed after retries",
      alarmTopic: props.alertsStack.alarmTopic
    });
    const deleteCard = new NodejsFunction(this, "DeleteCardFunction", {
      entry: resolve(__dirname, "../lambdas/vaultDeleteCard.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      retryAttempts: 2,
      onFailure: new SqsDestination(deleteCardFailures.queue),
      logGroup: new LogGroup(this, "DeleteCardLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(deleteCard, "dynamodb:DeleteItem");

    const updateCardFailures = new FailureQueue(this, "UpdateCardFailures", {
      description: "Async card expiration updates failed after retries",
      alarmTopic: props.alertsStack.alarmTopic
    });
    const updateCard = new NodejsFunction(this, "UpdateCardFunction", {
      entry: resolve(__dirname, "../lambdas/vaultUpdateCardExpiration.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      retryAttempts: 2,
      onFailure: new SqsDestination(updateCardFailures.queue),
      logGroup: new LogGroup(this, "UpdateCardLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(updateCard, "dynamodb:UpdateItem");

    this.chargeCardFunction = new NodejsFunction(this, "ChargeCardFunction", {
      entry: resolve(__dirname, "../lambdas/vaultChargeCard.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(10),
      logGroup: new LogGroup(this, "ChargeCardLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName,
        VAULT_KEY_ID: cardKey.keyArn
      }
    });
    cardTable.grant(this.chargeCardFunction, "dynamodb:GetItem");
    cardKey.grant(this.chargeCardFunction, "kms:Decrypt");

    this.invokeFunctions = {
      deleteCard,
      describeCard,
      updateCard
    };

    new CfnOutput(this, "CardTableName", { value: cardTable.tableName });
    new CfnOutput(this, "CardKeyArn", { value: cardKey.keyArn });
    new CfnOutput(this, "InvokeFunctionNames", {
      value: this.toJsonString(
        Object.fromEntries(Object.entries(this.invokeFunctions).map(([key, func]) => [key, func.functionName]))
      )
    });
  }
}
