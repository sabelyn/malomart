import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { DynamoDBBatchItemFailure, DynamoDBRecord, DynamoDBStreamHandler } from "aws-lambda";

const { PRODUCTS_TABLE_NAME } = process.env;

const db = dbClient();

const syncRecord = async (record: DynamoDBRecord) => {
  const image = record.dynamodb?.NewImage;
  const id = image?.id?.S;
  const stockCount = image?.stockCount?.N;
  if (!id || stockCount === undefined) {
    return;
  }

  const inStock = Number(stockCount) > 0 ? 1 : 0;
  try {
    await db.send(
      new UpdateCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Key: { id },
        UpdateExpression: "SET inStock = :inStock",
        ConditionExpression: inStock ? "stockCount > :zero" : "stockCount = :zero",
        ExpressionAttributeValues: { ":inStock": inStock, ":zero": 0 }
      })
    );
  } catch (err) {
    if (!(err instanceof Error) || err.name !== "ConditionalCheckFailedException") {
      throw err;
    }
  }
};

export const handler: DynamoDBStreamHandler = async event => {
  const results = await Promise.allSettled(event.Records.map(syncRecord));

  const batchItemFailures: DynamoDBBatchItemFailure[] = [];
  results.forEach((result, i) => {
    if (result.status === "rejected") {
      console.error(`Failed to sync stock flag for record ${i}.`, result.reason);
      batchItemFailures.push({ itemIdentifier: event.Records[i].dynamodb!.SequenceNumber! });
    }
  });
  return { batchItemFailures };
};
