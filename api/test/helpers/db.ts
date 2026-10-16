import type { BatchWriteCommandOutput, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

const BATCH_SIZE = 25;

const chunk = <T>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

const batchWrite = async (db: DynamoDBDocumentClient, tableName: string, requests: Record<string, unknown>[]) => {
  for (const batch of chunk(requests, BATCH_SIZE)) {
    let unprocessed: Record<string, unknown>[] | undefined = batch;
    while (unprocessed?.length) {
      const result: BatchWriteCommandOutput = await db.send(
        new BatchWriteCommand({ RequestItems: { [tableName]: unprocessed } })
      );
      unprocessed = result.UnprocessedItems?.[tableName];
    }
  }
};

const tracked = new Map<string, Map<string, Record<string, unknown>>>();
const touched = new Set<string>();

export const wasTouched = (tableName: string) => touched.has(tableName);

export const track = (tableName: string, ...keys: Record<string, unknown>[]) => {
  touched.add(tableName);
  const table = tracked.get(tableName) ?? new Map<string, Record<string, unknown>>();
  for (const key of keys) {
    table.set(JSON.stringify(key), key);
  }
  tracked.set(tableName, table);
};

const pickKey = (item: Record<string, unknown>, keyNames: string[]) =>
  Object.fromEntries(keyNames.map(name => [name, item[name]]));

export const putItems = async (
  db: DynamoDBDocumentClient,
  tableName: string,
  items: Record<string, unknown>[],
  keyNames = ["id"]
) => {
  track(tableName, ...items.map(item => pickKey(item, keyNames)));
  await batchWrite(
    db,
    tableName,
    items.map(Item => ({ PutRequest: { Item } }))
  );
};

export const trackWhere = async (
  db: DynamoDBDocumentClient,
  tableName: string,
  attribute: string,
  value: unknown,
  keyNames = ["id"]
) => {
  let lastKey: Record<string, unknown> | undefined;
  do {
    const result = await db.send(
      new ScanCommand({
        TableName: tableName,
        ConsistentRead: true,
        FilterExpression: "#attr = :value",
        ProjectionExpression: keyNames.map((_, i) => `#k${i}`).join(", "),
        ExpressionAttributeNames: {
          "#attr": attribute,
          ...Object.fromEntries(keyNames.map((key, i) => [`#k${i}`, key]))
        },
        ExpressionAttributeValues: { ":value": value },
        ExclusiveStartKey: lastKey
      })
    );
    track(tableName, ...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
};

export const deleteTracked = async (db: DynamoDBDocumentClient) => {
  const tables = [...tracked.entries()];
  tracked.clear();
  await Promise.all(
    tables.map(([tableName, keys]) =>
      batchWrite(
        db,
        tableName,
        [...keys.values()].map(Key => ({ DeleteRequest: { Key } }))
      )
    )
  );
};
