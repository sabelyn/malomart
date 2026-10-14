import type { TableIndexes, TableNames } from "@mm/clients";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, StreamViewType, Table } from "aws-cdk-lib/aws-dynamodb";
import { Architecture, FilterCriteria, FilterRule, Runtime, StartingPosition } from "aws-cdk-lib/aws-lambda";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import path from "node:path";

export const INDEXES: TableIndexes = {
  addressesByCustomer: "IDX_ADDRESSES_CUSTOMER",
  ordersByCustomer: "IDX_ORDERS_CUSTOMER",
  ordersByCustomerStatus: "IDX_ORDERS_CUSTOMER_STATUS",
  ordersByStatus: "IDX_ORDERS_STATUS",
  paymentMethodsByCustomer: "IDX_PAYMENT_METHODS_CUSTOMER",
  productsByCategory: "IDX_PRODUCTS_CATEGORY",
  productsByCategoryInStock: "IDX_PRODUCTS_CATEGORY_IN_STOCK"
};

export class DbStack extends Stack {
  readonly tables: Record<keyof TableNames, Table>;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const addressesTable = new Table(this, "AddressesTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });
    addressesTable.addGlobalSecondaryIndex({
      indexName: INDEXES.addressesByCustomer,
      partitionKey: { name: "customerId", type: AttributeType.STRING },
      sortKey: { name: "id", type: AttributeType.STRING }
    });

    const customersTable = new Table(this, "CustomersTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });

    const cartsTable = new Table(this, "CartsTable", {
      partitionKey: { name: "customerId", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });

    const ordersTable = new Table(this, "OrdersTableV2", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });
    ordersTable.addGlobalSecondaryIndex({
      indexName: INDEXES.ordersByCustomer,
      partitionKey: { name: "customerId", type: AttributeType.STRING },
      sortKeys: [
        { name: "orderDate", type: AttributeType.STRING },
        { name: "id", type: AttributeType.STRING }
      ]
    });
    ordersTable.addGlobalSecondaryIndex({
      indexName: INDEXES.ordersByStatus,
      partitionKey: { name: "currentStatus", type: AttributeType.STRING },
      sortKeys: [
        { name: "orderDate", type: AttributeType.STRING },
        { name: "id", type: AttributeType.STRING }
      ]
    });
    ordersTable.addGlobalSecondaryIndex({
      indexName: INDEXES.ordersByCustomerStatus,
      partitionKeys: [
        { name: "customerId", type: AttributeType.STRING },
        { name: "currentStatus", type: AttributeType.STRING }
      ],
      sortKeys: [
        { name: "orderDate", type: AttributeType.STRING },
        { name: "id", type: AttributeType.STRING }
      ]
    });

    const paymentMethodsTable = new Table(this, "PaymentMethodsTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST
    });
    paymentMethodsTable.addGlobalSecondaryIndex({
      indexName: INDEXES.paymentMethodsByCustomer,
      partitionKey: { name: "customerId", type: AttributeType.STRING },
      sortKey: { name: "id", type: AttributeType.STRING }
    });

    const productsTable = new Table(this, "ProductsTable", {
      partitionKey: { name: "id", type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      stream: StreamViewType.NEW_IMAGE
    });
    productsTable.addGlobalSecondaryIndex({
      indexName: INDEXES.productsByCategory,
      partitionKey: { name: "category", type: AttributeType.STRING },
      sortKey: { name: "id", type: AttributeType.STRING }
    });
    productsTable.addGlobalSecondaryIndex({
      indexName: INDEXES.productsByCategoryInStock,
      partitionKeys: [
        { name: "category", type: AttributeType.STRING },
        { name: "inStock", type: AttributeType.NUMBER }
      ],
      sortKey: { name: "id", type: AttributeType.STRING }
    });

    const stockFlagSync = new NodejsFunction(this, "StockFlagSyncFunction", {
      entry: path.resolve(__dirname, "../lambdas/stockFlagSync.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      timeout: Duration.seconds(30),
      logGroup: new LogGroup(this, "StockFlagSyncLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      environment: {
        PRODUCTS_TABLE_NAME: productsTable.tableName
      }
    });
    productsTable.grant(stockFlagSync, "dynamodb:UpdateItem");

    const stockFlagSyncDlq = new Queue(this, "StockFlagSyncDlq", {
      retentionPeriod: Duration.days(14)
    });

    stockFlagSync.addEventSource(
      new DynamoEventSource(productsTable, {
        startingPosition: StartingPosition.LATEST,
        batchSize: 25,
        maxBatchingWindow: Duration.seconds(1),
        bisectBatchOnError: true,
        retryAttempts: 3,
        reportBatchItemFailures: true,
        onFailure: new SqsDlq(stockFlagSyncDlq),
        filters: [
          FilterCriteria.filter({
            dynamodb: { NewImage: { stockCount: { N: FilterRule.isEqual("0") }, inStock: { N: FilterRule.isEqual("1") } } }
          }),
          FilterCriteria.filter({
            dynamodb: { NewImage: { stockCount: { N: FilterRule.notEquals("0") }, inStock: { N: FilterRule.isEqual("0") } } }
          })
        ]
      })
    );

    this.tables = {
      addresses: addressesTable,
      carts: cartsTable,
      customers: customersTable,
      orders: ordersTable,
      paymentMethods: paymentMethodsTable,
      products: productsTable
    };

    new CfnOutput(this, "TableNames", {
      value: this.toJsonString(
        Object.fromEntries(Object.entries(this.tables).map(([key, table]) => [key, table.tableName]))
      )
    });
    new CfnOutput(this, "TableIndexes", { value: JSON.stringify(INDEXES) });
  }
}
