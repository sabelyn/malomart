import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/stockFlagSync";
import { awsError, invoke } from "../../helpers/lambda";

const db = mockClient(dbClient());

const record = (id: string, stockCount: number, sequence = "1"): DynamoDBRecord => ({
  eventName: "MODIFY",
  dynamodb: {
    SequenceNumber: sequence,
    NewImage: { id: { S: id }, stockCount: { N: String(stockCount) } }
  }
});

const run = (...Records: DynamoDBRecord[]) =>
  invoke(handler, { Records } satisfies DynamoDBStreamEvent) as Promise<DynamoDBBatchResponse>;

beforeEach(() => {
  db.reset();
  db.on(UpdateCommand).resolves({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("clears the flag when stock runs out", async () => {
  const id = crypto.randomUUID();

  await expect(run(record(id, 0))).resolves.toEqual({ batchItemFailures: [] });

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: "products",
    Key: { id },
    UpdateExpression: "SET inStock = :inStock",
    ConditionExpression: "stockCount = :zero",
    ExpressionAttributeValues: { ":inStock": 0, ":zero": 0 }
  });
});

it("sets the flag when stock is replenished", async () => {
  const id = crypto.randomUUID();

  await run(record(id, 4));

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    Key: { id },
    ConditionExpression: "stockCount > :zero",
    ExpressionAttributeValues: { ":inStock": 1, ":zero": 0 }
  });
});

it("updates every product in the batch", async () => {
  await run(
    record(crypto.randomUUID(), 0, "1"),
    record(crypto.randomUUID(), 0, "2"),
    record(crypto.randomUUID(), 3, "3")
  );

  expect(db).toHaveReceivedCommandTimes(UpdateCommand, 3);
});

it("skips records without a new image", async () => {
  await run({ eventName: "REMOVE", dynamodb: { SequenceNumber: "1", OldImage: { id: { S: "gone" } } } });

  expect(db).not.toHaveReceivedAnyCommand();
});

it("treats a failed condition as already in sync", async () => {
  db.on(UpdateCommand).rejects(awsError("ConditionalCheckFailedException"));

  await expect(run(record(crypto.randomUUID(), 0))).resolves.toEqual({ batchItemFailures: [] });
});

it("reports only the records that failed", async () => {
  const failing = crypto.randomUUID();
  db.on(UpdateCommand, { Key: { id: failing } }).rejects(awsError("ThrottlingException"));

  const response = await run(
    record(crypto.randomUUID(), 0, "1"),
    record(failing, 0, "2"),
    record(crypto.randomUUID(), 5, "3")
  );

  expect(response).toEqual({ batchItemFailures: [{ itemIdentifier: "2" }] });
});
