import { ORDER_EVENT_SOURCE, OrderEventType, OrderStatus } from "@mm/lib/orders";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Alias, Architecture, FilterCriteria, FilterRule, Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import path from "node:path";

import { FailureQueue } from "../constructs/FailureQueue";
import type { AlertsStack } from "./AlertsStack";
import type { AuthStack } from "./AuthStack";
import type { DbStack } from "./DbStack";
import type { VaultStack } from "./VaultStack";

type Props = StackProps & {
  alertsStack: AlertsStack;
  authStack: AuthStack;
  dbStack: DbStack;
  vaultStack: VaultStack;
  appOrigin: string;
  emailDomain?: string;
  timeScale: number;
};

const statusChanged = (...statuses: OrderStatus[]) => ({
  source: [ORDER_EVENT_SOURCE],
  detailType: [OrderEventType.StatusChanged],
  detail: { status: statuses }
});

export class OrdersStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { alarmTopic } = props.alertsStack;
    const { orders, products } = props.dbStack.tables;
    const { chargeCardFunction } = props.vaultStack;

    const createFunction = (name: string, entry: string, overrides: NodejsFunctionProps) =>
      new NodejsFunction(this, `${name}Function`, {
        entry: path.resolve(__dirname, `../lambdas/${entry}.ts`),
        runtime: Runtime.NODEJS_24_X,
        architecture: Architecture.ARM_64,
        timeout: Duration.seconds(30),
        logGroup: new LogGroup(this, `${name}Logs`, {
          retention: RetentionDays.ONE_WEEK,
          removalPolicy: RemovalPolicy.DESTROY
        }),
        ...overrides
      });

    const eventBus = new EventBus(this, "EventBus");

    const invalidRecords = new FailureQueue(this, "InvalidOrderRecords", {
      description: "Order records in the table failed validation and need investigating",
      alarmTopic
    }).queue;
    const publisher = createFunction("StreamPublisher", "orderStreamPublisher", {
      environment: {
        EVENT_BUS_NAME: eventBus.eventBusName,
        INVALID_RECORDS_QUEUE_URL: invalidRecords.queueUrl
      }
    });
    eventBus.grantPutEventsTo(publisher);
    invalidRecords.grantSendMessages(publisher);

    const publisherDlq = new FailureQueue(this, "StreamPublisherFailures", {
      description: "Order stream records failed to publish status change events",
      alarmTopic
    }).queue;
    publisher.addEventSource(
      new DynamoEventSource(orders, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 10,
        maxBatchingWindow: Duration.seconds(1),
        bisectBatchOnError: true,
        retryAttempts: 3,
        reportBatchItemFailures: true,
        onFailure: new SqsDlq(publisherDlq),
        filters: [FilterCriteria.filter({ eventName: FilterRule.or("INSERT", "MODIFY") })]
      })
    );

    const fulfillment = createFunction("Fulfillment", "orderFulfillment", {
      durableConfig: {
        executionTimeout: Duration.hours(1),
        retentionPeriod: Duration.days(7)
      },
      environment: {
        CHARGE_CARD_FUNCTION_NAME: chargeCardFunction.functionName,
        ORDERS_TABLE_NAME: orders.tableName,
        TIME_SCALE: String(props.timeScale)
      }
    });
    orders.grant(fulfillment, "dynamodb:GetItem", "dynamodb:UpdateItem");
    chargeCardFunction.grantInvoke(fulfillment);
    const fulfillmentAlias = new Alias(this, "FulfillmentAlias", {
      aliasName: "live",
      version: fulfillment.currentVersion
    });

    const fulfillmentFailures = new FailureQueue(this, "FulfillmentFailures", {
      description: "Placed orders failed to start fulfillment",
      alarmTopic
    });
    new Rule(this, "StartFulfillmentRule", {
      eventBus,
      eventPattern: statusChanged(OrderStatus.Placed),
      targets: [new LambdaFunction(fulfillmentAlias, { deadLetterQueue: fulfillmentFailures.queue, retryAttempts: 4 })]
    });
    new Alarm(this, "FulfillmentErrorsAlarm", {
      alarmDescription: "Order fulfillment executions are failing",
      metric: fulfillmentAlias.metricErrors({ period: Duration.minutes(5) }),
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING
    }).addAlarmAction(new SnsAction(alarmTopic));

    const restockFailures = new FailureQueue(this, "RestockFailures", {
      description: "Cancelled orders failed to restore product stock",
      alarmTopic
    });
    const restock = createFunction("Restock", "orderRestock", {
      retryAttempts: 2,
      onFailure: new SqsDestination(restockFailures.queue),
      environment: {
        ORDERS_TABLE_NAME: orders.tableName,
        PRODUCTS_TABLE_NAME: products.tableName
      }
    });
    orders.grant(restock, "dynamodb:GetItem", "dynamodb:UpdateItem");
    products.grant(restock, "dynamodb:BatchGetItem", "dynamodb:UpdateItem");
    new Rule(this, "RestockRule", {
      eventBus,
      eventPattern: statusChanged(OrderStatus.Cancelled),
      targets: [new LambdaFunction(restock, { deadLetterQueue: restockFailures.queue, retryAttempts: 4 })]
    });

    if (props.emailDomain) {
      const { userPool } = props.authStack;
      const notifierFailures = new FailureQueue(this, "NotifierFailures", {
        description: "Order status emails failed to send",
        alarmTopic
      });
      const notifier = createFunction("Notifier", "orderNotifier", {
        retryAttempts: 2,
        onFailure: new SqsDestination(notifierFailures.queue),
        environment: {
          APP_ORIGIN: props.appOrigin,
          EMAIL_FROM: `"Malo Mart" <noreply@${props.emailDomain}>`,
          ORDERS_TABLE_NAME: orders.tableName,
          PRODUCTS_TABLE_NAME: products.tableName,
          USER_POOL_ID: userPool.userPoolId
        }
      });
      orders.grant(notifier, "dynamodb:GetItem");
      products.grant(notifier, "dynamodb:BatchGetItem");
      userPool.grant(notifier, "cognito-idp:AdminGetUser");
      notifier.addToRolePolicy(
        new PolicyStatement({
          actions: ["ses:SendEmail"],
          resources: [this.formatArn({ service: "ses", resource: "identity", resourceName: "*" })]
        })
      );
      new Rule(this, "NotifyRule", {
        eventBus,
        eventPattern: statusChanged(
          OrderStatus.Confirmed,
          OrderStatus.Shipped,
          OrderStatus.Delivered,
          OrderStatus.Cancelled
        ),
        targets: [new LambdaFunction(notifier, { deadLetterQueue: notifierFailures.queue, retryAttempts: 4 })]
      });
    }

    new CfnOutput(this, "EventBusName", { value: eventBus.eventBusName });
    new CfnOutput(this, "FulfillmentFunctionName", { value: fulfillment.functionName });
    new CfnOutput(this, "FailureQueueUrls", {
      value: this.toJsonString(
        this.node.children.filter(child => child instanceof FailureQueue).map(({ queue }) => queue.queueUrl)
      )
    });
  }
}
