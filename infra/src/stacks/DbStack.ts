import type { TableIndexes, TableNames } from "@mm/clients";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Stack } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export const INDEXES: TableIndexes = {
  addressesByCustomer: "IDX_ADDRESSES_CUSTOMER",
  ordersByCustomer: "IDX_ORDERS_CUSTOMER",
  ordersByCustomerStatus: "IDX_ORDERS_CUSTOMER_STATUS",
  ordersByStatus: "IDX_ORDERS_STATUS",
  paymentMethodsByCustomer: "IDX_PAYMENT_METHODS_CUSTOMER",
  productsByCategory: "IDX_PRODUCTS_CATEGORY"
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

    const ordersTable = new Table(this, "OrdersTable", {
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
      partitionKey: { name: "status", type: AttributeType.STRING },
      sortKeys: [
        { name: "orderDate", type: AttributeType.STRING },
        { name: "id", type: AttributeType.STRING }
      ]
    });
    ordersTable.addGlobalSecondaryIndex({
      indexName: INDEXES.ordersByCustomerStatus,
      partitionKeys: [
        { name: "customerId", type: AttributeType.STRING },
        { name: "status", type: AttributeType.STRING }
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
      billingMode: BillingMode.PAY_PER_REQUEST
    });
    productsTable.addGlobalSecondaryIndex({
      indexName: INDEXES.productsByCategory,
      partitionKey: { name: "category", type: AttributeType.STRING },
      sortKey: { name: "id", type: AttributeType.STRING }
    });

    this.tables = {
      addresses: addressesTable,
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
