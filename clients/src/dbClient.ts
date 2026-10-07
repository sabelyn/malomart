import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { ScanCommandInput } from "@aws-sdk/lib-dynamodb";
import { DynamoDBDocumentClient, GetCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { infer as zinfer } from "zod";
import { number, record, strictObject, string, union } from "zod";

let baseClient: DynamoDBDocumentClient;
export const dbClient = () => {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  baseClient ??= DynamoDBDocumentClient.from(new DynamoDBClient(endpoint ? { endpoint } : {}));
  return baseClient;
};

export const TableNames = strictObject({
  addresses: string().nonempty(),
  customers: string().nonempty(),
  orders: string().nonempty(),
  paymentMethods: string().nonempty(),
  products: string().nonempty()
});
export type TableNames = zinfer<typeof TableNames>;

export const TableIndexes = strictObject({
  addressesByCustomer: string().nonempty(),
  ordersByCustomer: string().nonempty(),
  ordersByStatus: string().nonempty(),
  paymentMethodsByCustomer: string().nonempty(),
  productsByCategory: string().nonempty()
});
export type TableIndexes = zinfer<typeof TableIndexes>;

export const getItemById = async <T = unknown>(
  client: DynamoDBDocumentClient,
  TableName: string,
  id: string
): Promise<T | null> => {
  const result = await client.send(new GetCommand({ TableName, Key: { id } }));
  return result.Item ? (result.Item as T) : null;
};

export type PaginatedQueryOptions = {
  tableName: string;
  keys: string[];
  limit: number;
  cursor?: string;
  select?: string[];
  filter?: string;
  indexName?: string;
  keyCondition?: string;
  attributeValues?: Record<string, unknown>;
  maxRequests?: number;
};

export class InvalidCursorError extends Error {
  override readonly name = "InvalidCursorError";
}

const CursorKey = record(string(), union([string(), number()]));
type CursorKey = zinfer<typeof CursorKey>;

const encodeCursor = (key: CursorKey) => Buffer.from(JSON.stringify(key)).toString("base64url");

const decodeCursor = (cursor: string, keys: string[]) => {
  let key: CursorKey;
  try {
    key = CursorKey.parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
  } catch (err) {
    throw new InvalidCursorError("Pagination cursor is invalid.", { cause: err });
  }

  const cursorKeys = Object.keys(key);
  if (cursorKeys.length !== keys.length || !keys.every(k => k in key)) {
    throw new InvalidCursorError("Pagination cursor is invalid.");
  }
  return key;
};

const pick = (item: Record<string, unknown>, attributes: string[]) =>
  Object.fromEntries(attributes.filter(a => a in item).map(a => [a, item[a]]));

export const getPaginatedResults = async (client: DynamoDBDocumentClient, options: PaginatedQueryOptions) => {
  const {
    tableName,
    keys,
    limit,
    cursor,
    select,
    filter,
    indexName,
    keyCondition,
    attributeValues,
    maxRequests = 10
  } = options;

  const projected = select ? [...new Set([...select, ...keys])] : undefined;
  const input: ScanCommandInput = {
    TableName: tableName,
    Limit: limit,
    ...(indexName ? { IndexName: indexName } : {}),
    ...(filter ? { FilterExpression: filter } : {}),
    ...(attributeValues ? { ExpressionAttributeValues: attributeValues } : {}),
    ...(projected
      ? {
          ProjectionExpression: projected.map((_, i) => `#sel${i}`).join(", "),
          ExpressionAttributeNames: Object.fromEntries(projected.map((name, i) => [`#sel${i}`, name]))
        }
      : {})
  };

  const items: Record<string, unknown>[] = [];
  let lastKey: Record<string, unknown> | undefined = cursor ? decodeCursor(cursor, keys) : undefined;
  let requests = 0;
  do {
    const command = keyCondition
      ? new QueryCommand({ ...input, KeyConditionExpression: keyCondition, ExclusiveStartKey: lastKey })
      : new ScanCommand({ ...input, ExclusiveStartKey: lastKey });
    const result = await client.send(command);

    items.push(...(result.Items ?? []));
    lastKey = result.LastEvaluatedKey;
    requests++;
  } while (lastKey && items.length < limit && requests < maxRequests);

  const page = items.slice(0, limit);
  const nextKey = items.length > limit ? pick(page.at(-1)!, keys) : lastKey;

  return {
    items: select ? page.map(item => pick(item, select)) : page,
    hasNext: !!nextKey,
    cursor: nextKey ? encodeCursor(CursorKey.parse(nextKey)) : undefined
  };
};
