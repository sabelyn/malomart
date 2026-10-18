import type { InvokeFunctionNames } from "@mm/clients/lambda";
import { tokenizeCard } from "@mm/lib/lambdas";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { HttpMethod, HttpRoute, HttpRouteKey } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Key } from "aws-cdk-lib/aws-kms";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import type { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";

import { FailureQueue } from "../constructs/FailureQueue";
import { createFunction } from "../helpers";
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

    const tokenizer = createFunction(this, "Tokenizer", "vaultCardTokenizer", {
      timeout: Duration.seconds(10),
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

    const describeCard = createFunction(this, "DescribeCard", "vaultDescribeCard", {
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(describeCard, "dynamodb:GetItem");

    const deleteCardFailures = new FailureQueue(this, "DeleteCardFailures", {
      description: "Async card deletions failed after retries",
      alarmTopic: props.alertsStack.alarmTopic
    });
    const deleteCard = createFunction(this, "DeleteCard", "vaultDeleteCard", {
      retryAttempts: 2,
      onFailure: new SqsDestination(deleteCardFailures.queue),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(deleteCard, "dynamodb:DeleteItem");

    const updateCardFailures = new FailureQueue(this, "UpdateCardFailures", {
      description: "Async card expiration updates failed after retries",
      alarmTopic: props.alertsStack.alarmTopic
    });
    const updateCard = createFunction(this, "UpdateCard", "vaultUpdateCardExpiration", {
      retryAttempts: 2,
      onFailure: new SqsDestination(updateCardFailures.queue),
      environment: {
        VAULT_CARD_TABLE_NAME: cardTable.tableName
      }
    });
    cardTable.grant(updateCard, "dynamodb:UpdateItem");

    this.chargeCardFunction = createFunction(this, "ChargeCard", "vaultChargeCard", {
      timeout: Duration.seconds(10),
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
