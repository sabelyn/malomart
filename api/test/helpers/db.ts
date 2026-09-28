import type { BatchWriteCommandOutput, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const BATCH_SIZE = 25;

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const batchWrite = async (db: DynamoDBDocumentClient, tableName: string, requests: Record<string, unknown>[]) => {
  for (const batch of chunk(requests, BATCH_SIZE)) {
    let unprocessed: Record<string, unknown>[] | undefined = batch;
    while (unprocessed?.length) {
      const result: BatchWriteCommandOutput = await db.send(new BatchWriteCommand({ RequestItems: { [tableName]: unprocessed } }));
      unprocessed = result.UnprocessedItems?.[tableName];
    }
  }
};

export const putItems = (db: DynamoDBDocumentClient, tableName: string, items: Record<string, unknown>[]) =>
  batchWrite(
    db,
    tableName,
    items.map(Item => ({ PutRequest: { Item } }))
  );

export const clearTable = async (db: DynamoDBDocumentClient, tableName: string, keys: string[]) => {
  const keyItems: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new ScanCommand({
        TableName: tableName,
        ProjectionExpression: keys.map((_, i) => `#k${i}`).join(", "),
        ExpressionAttributeNames: Object.fromEntries(keys.map((key, i) => [`#k${i}`, key])),
        ExclusiveStartKey: lastKey
      })
    );
    keyItems.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  await batchWrite(
    db,
    tableName,
    keyItems.map(Key => ({ DeleteRequest: { Key } }))
  );
};
