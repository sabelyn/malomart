import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";

import type { PaginatedQueryOptions } from "../../src/dbClient";
import { getPaginatedResults, InvalidCursorError } from "../../src/dbClient";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }));
const ddb = mockClient(client);

const encode = (key: unknown) => Buffer.from(JSON.stringify(key)).toString("base64url");
const decode = (cursor: string | undefined) => JSON.parse(Buffer.from(cursor ?? "", "base64url").toString("utf8"));

const baseOptions: PaginatedQueryOptions = {
  tableName: "products",
  keys: ["id"],
  limit: 2
};

const categoryOptions: PaginatedQueryOptions = {
  ...baseOptions,
  keys: ["category", "id"],
  indexName: "byCategory",
  keyCondition: "category = :cat",
  attributeValues: { ":cat": "Food" }
};

describe("dbClient", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the same instance on repeated calls", async () => {
    const { dbClient } = await import("../../src/dbClient.js");
    expect(dbClient()).toBe(dbClient());
  });

  it("uses AWS_ENDPOINT_URL when set", async () => {
    vi.stubEnv("AWS_ENDPOINT_URL", "http://localhost:8000");
    const { dbClient } = await import("../../src/dbClient.js");

    const endpoint = await dbClient().config.endpoint?.();
    expect(endpoint?.hostname).toBe("localhost");
    expect(endpoint?.port).toBe(8000);
  });
});

describe("getPaginatedResults", () => {
  beforeEach(() => {
    ddb.reset();
  });

  describe("command selection", () => {
    it("scans when there is no key condition", async () => {
      ddb.on(ScanCommand).resolves({ Items: [] });

      await getPaginatedResults(client, {
        ...baseOptions,
        filter: "inStock > :zero",
        attributeValues: { ":zero": 0 }
      });

      expect(ddb).toHaveReceivedCommandWith(ScanCommand, {
        TableName: "products",
        Limit: 2,
        FilterExpression: "inStock > :zero",
        ExpressionAttributeValues: { ":zero": 0 }
      });
      expect(ddb).not.toHaveReceivedCommand(QueryCommand);
    });

    it("queries when there is a key condition", async () => {
      ddb.on(QueryCommand).resolves({ Items: [] });

      await getPaginatedResults(client, categoryOptions);

      expect(ddb).toHaveReceivedCommandWith(QueryCommand, {
        TableName: "products",
        Limit: 2,
        IndexName: "byCategory",
        KeyConditionExpression: "category = :cat",
        ExpressionAttributeValues: { ":cat": "Food" }
      });
      expect(ddb).not.toHaveReceivedCommand(ScanCommand);
    });

    it("omits optional expressions when not provided", async () => {
      ddb.on(ScanCommand).resolves({ Items: [] });

      await getPaginatedResults(client, baseOptions);

      const input = ddb.commandCalls(ScanCommand)[0]!.args[0].input;
      expect(input).not.toHaveProperty("IndexName");
      expect(input).not.toHaveProperty("FilterExpression");
      expect(input).not.toHaveProperty("ExpressionAttributeValues");
      expect(input).not.toHaveProperty("ProjectionExpression");
      expect(input).not.toHaveProperty("ExpressionAttributeNames");
    });
  });

  describe("projection", () => {
    it("adds key attributes to the projection using placeholder names", async () => {
      ddb.on(QueryCommand).resolves({ Items: [] });

      await getPaginatedResults(client, { ...categoryOptions, select: ["id", "title"] });

      expect(ddb).toHaveReceivedCommandWith(QueryCommand, {
        ProjectionExpression: "#sel0, #sel1, #sel2",
        ExpressionAttributeNames: { "#sel0": "id", "#sel1": "title", "#sel2": "category" }
      });
    });

    it("strips unselected key attributes from returned items", async () => {
      ddb.on(QueryCommand).resolves({ Items: [{ id: "a", category: "Food", title: "Apple" }] });

      const result = await getPaginatedResults(client, { ...categoryOptions, select: ["id", "title"] });

      expect(result.items).toEqual([{ id: "a", title: "Apple" }]);
    });

    it("returns items untouched when nothing is selected", async () => {
      const items = [{ id: "a", title: "Apple", price: 5 }];
      ddb.on(ScanCommand).resolves({ Items: items });

      const result = await getPaginatedResults(client, baseOptions);

      expect(result.items).toEqual(items);
    });
  });

  describe("paging", () => {
    it("returns a final page without a cursor", async () => {
      ddb.on(ScanCommand).resolves({ Items: [{ id: "a" }] });

      const result = await getPaginatedResults(client, baseOptions);

      expect(result).toEqual({ items: [{ id: "a" }], hasNext: false, cursor: undefined });
      expect(ddb).toHaveReceivedCommandTimes(ScanCommand, 1);
    });

    it("uses LastEvaluatedKey as the cursor when the page fills exactly", async () => {
      ddb.on(ScanCommand).resolves({
        Items: [{ id: "a" }, { id: "b" }],
        LastEvaluatedKey: { id: "b" }
      });

      const result = await getPaginatedResults(client, baseOptions);

      expect(result.items).toEqual([{ id: "a" }, { id: "b" }]);
      expect(result.hasNext).toBe(true);
      expect(decode(result.cursor)).toEqual({ id: "b" });
      expect(ddb).toHaveReceivedCommandTimes(ScanCommand, 1);
    });

    it("keeps fetching until the page is filled", async () => {
      ddb
        .on(QueryCommand)
        .resolvesOnce({ Items: [], LastEvaluatedKey: { category: "Food", id: "a" } })
        .resolvesOnce({ Items: [{ id: "b", category: "Food" }], LastEvaluatedKey: { category: "Food", id: "c" } })
        .resolvesOnce({ Items: [{ id: "d", category: "Food" }], LastEvaluatedKey: { category: "Food", id: "e" } });

      const result = await getPaginatedResults(client, categoryOptions);

      expect(result.items.map(item => item.id)).toEqual(["b", "d"]);
      expect(decode(result.cursor)).toEqual({ category: "Food", id: "e" });
      expect(ddb).toHaveReceivedCommandTimes(QueryCommand, 3);
      expect(ddb).toHaveReceivedNthCommandWith(QueryCommand, 2, {
        ExclusiveStartKey: { category: "Food", id: "a" }
      });
      expect(ddb).toHaveReceivedNthCommandWith(QueryCommand, 3, {
        ExclusiveStartKey: { category: "Food", id: "c" }
      });
    });

    it("trims an overfilled page and builds the cursor from the last kept item", async () => {
      ddb
        .on(QueryCommand)
        .resolvesOnce({ Items: [{ id: "a", category: "Food" }], LastEvaluatedKey: { category: "Food", id: "a" } })
        .resolvesOnce({
          Items: [
            { id: "b", category: "Food" },
            { id: "c", category: "Food" }
          ],
          LastEvaluatedKey: { category: "Food", id: "c" }
        });

      const result = await getPaginatedResults(client, { ...categoryOptions, select: ["id"] });

      expect(result.items).toEqual([{ id: "a" }, { id: "b" }]);
      expect(result.hasNext).toBe(true);
      expect(decode(result.cursor)).toEqual({ category: "Food", id: "b" });
    });

    it("stops after maxRequests and returns what it has with a cursor", async () => {
      ddb.on(ScanCommand).resolves({ Items: [], LastEvaluatedKey: { id: "z" } });

      const result = await getPaginatedResults(client, { ...baseOptions, maxRequests: 3 });

      expect(ddb).toHaveReceivedCommandTimes(ScanCommand, 3);
      expect(result.items).toEqual([]);
      expect(result.hasNext).toBe(true);
      expect(decode(result.cursor)).toEqual({ id: "z" });
    });

    it("defaults maxRequests to 10", async () => {
      ddb.on(ScanCommand).resolves({ Items: [], LastEvaluatedKey: { id: "z" } });

      await getPaginatedResults(client, baseOptions);

      expect(ddb).toHaveReceivedCommandTimes(ScanCommand, 10);
    });
  });

  describe("cursors", () => {
    it("starts from the decoded cursor", async () => {
      ddb.on(QueryCommand).resolves({ Items: [] });

      await getPaginatedResults(client, { ...categoryOptions, cursor: encode({ category: "Food", id: "m" }) });

      expect(ddb).toHaveReceivedCommandWith(QueryCommand, {
        ExclusiveStartKey: { category: "Food", id: "m" }
      });
    });

    it("round-trips a returned cursor into the next request", async () => {
      ddb
        .on(ScanCommand)
        .resolvesOnce({ Items: [{ id: "a" }, { id: "b" }], LastEvaluatedKey: { id: "b" } })
        .resolvesOnce({ Items: [{ id: "c" }] });

      const first = await getPaginatedResults(client, baseOptions);
      const second = await getPaginatedResults(client, { ...baseOptions, cursor: first.cursor });

      expect(ddb).toHaveReceivedNthCommandWith(ScanCommand, 2, { ExclusiveStartKey: { id: "b" } });
      expect(second).toEqual({ items: [{ id: "c" }], hasNext: false, cursor: undefined });
    });

    it.each([
      ["not base64 json", "not-a-cursor!!"],
      ["not an object", encode(["id"])],
      ["using non-scalar key values", encode({ id: { nested: true } })],
      ["missing key attributes", encode({ category: "Food" })],
      ["carrying extra key attributes", encode({ id: "a", category: "Food" })]
    ])("rejects a cursor %s", async (_label, cursor) => {
      await expect(getPaginatedResults(client, { ...baseOptions, cursor })).rejects.toBeInstanceOf(InvalidCursorError);
      expect(ddb).not.toHaveReceivedCommand(ScanCommand);
    });
  });
});
