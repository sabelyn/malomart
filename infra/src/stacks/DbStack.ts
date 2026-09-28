import type { TableIndexes, TableNames } from "@mm/clients";
import { CfnOutput, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";

export const INDEXES: TableIndexes = {
  productsByCategory: "IDX_PRODUCTS_CATEGORY"
};

export class DbStack extends Stack {
  readonly tables: Record<keyof TableNames, Table>;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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
      products: productsTable
    };

    new CfnOutput(this, "TableNames", {
      value: this.toJsonString(Object.fromEntries(Object.entries(this.tables).map(([key, table]) => [key, table.tableName])))
    });
    new CfnOutput(this, "TableIndexes", { value: JSON.stringify(INDEXES) });
  }
}
