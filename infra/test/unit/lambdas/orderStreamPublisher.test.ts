import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { AttributeValue, DynamoDBBatchResponse, DynamoDBRecord, DynamoDBStreamEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/orderStreamPublisher";
import { invoke } from "../../helpers/lambda";

const eventBridge = mockClient(EventBridgeClient);
const sqs = mockClient(SQSClient);

const orderId = crypto.randomUUID();
const customerId = crypto.randomUUID();
const placedAt = "2026-10-16T12:00:00.000Z";
const confirmedAt = "2026-10-16T12:00:20.000Z";

const image = (status: string, statusUpdates: Record<string, string>): Record<string, AttributeValue> => ({
  id: { S: orderId },
  customerId: { S: customerId },
  currentStatus: { S: status },
  statusUpdates: { M: Object.fromEntries(Object.entries(statusUpdates).map(([key, at]) => [key, { S: at }])) }
});

const placed = image("Placed", { Placed: placedAt });
const confirmed = image("Confirmed", { Placed: placedAt, Confirmed: confirmedAt });

const record = (
  sequence: string,
  NewImage: Record<string, AttributeValue>,
  OldImage?: Record<string, AttributeValue>
): DynamoDBRecord => ({
  eventName: OldImage ? "MODIFY" : "INSERT",
  dynamodb: { SequenceNumber: sequence, NewImage, OldImage }
});

const run = (...Records: DynamoDBRecord[]) =>
  invoke(handler, { Records } satisfies DynamoDBStreamEvent) as Promise<DynamoDBBatchResponse>;

const publishedDetails = () =>
  eventBridge
    .commandCalls(PutEventsCommand)
    .flatMap(call => call.args[0].input.Entries ?? [])
    .map(entry => JSON.parse(entry.Detail!));

beforeEach(() => {
  eventBridge.reset();
  sqs.reset();
  sqs.on(SendMessageCommand).resolves({});
  eventBridge
    .on(PutEventsCommand)
    .callsFake(({ Entries }) =>
      Promise.resolve({ FailedEntryCount: 0, Entries: Entries.map(() => ({ EventId: crypto.randomUUID() })) })
    );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("publishes a placed event with no previous status for a new order", async () => {
  await expect(run(record("1", placed))).resolves.toEqual({ batchItemFailures: [] });

  expect(eventBridge).toHaveReceivedCommandWith(PutEventsCommand, {
    Entries: [
      expect.objectContaining({
        EventBusName: "order-events",
        Source: "malomart.orders",
        DetailType: "OrderStatusChanged"
      })
    ]
  });
  expect(publishedDetails()).toEqual([{ orderId, customerId, previousStatus: null, status: "Placed", at: placedAt }]);
});

it("publishes a status change with the time it was reached", async () => {
  await run(record("1", confirmed, placed));

  expect(publishedDetails()).toEqual([
    { orderId, customerId, previousStatus: "Placed", status: "Confirmed", at: confirmedAt }
  ]);
});

it("ignores modifications that leave the status alone", async () => {
  await expect(run(record("1", { ...placed, fulfillmentToken: { S: crypto.randomUUID() } }, placed))).resolves.toEqual({
    batchItemFailures: []
  });

  expect(eventBridge).not.toHaveReceivedAnyCommand();
});

it("publishes a whole batch in one call", async () => {
  await run(record("1", placed), record("2", confirmed, placed));

  expect(eventBridge).toHaveReceivedCommandTimes(PutEventsCommand, 1);
  expect(publishedDetails()).toHaveLength(2);
});

it("quarantines invalid records instead of retrying them", async () => {
  const { customerId: _, ...missingCustomer } = confirmed;

  await expect(run(record("1", missingCustomer, placed), record("2", placed))).resolves.toEqual({
    batchItemFailures: []
  });

  expect(publishedDetails()).toEqual([expect.objectContaining({ status: "Placed" })]);
  expect(sqs).toHaveReceivedCommandTimes(SendMessageCommand, 1);
  expect(sqs).toHaveReceivedCommandWith(SendMessageCommand, { QueueUrl: process.env.INVALID_RECORDS_QUEUE_URL });
  const message = JSON.parse(sqs.commandCalls(SendMessageCommand)[0].args[0].input.MessageBody!);
  expect(message).toEqual(
    expect.objectContaining({
      sequenceNumber: "1",
      newImage: missingCustomer,
      oldImage: placed,
      error: expect.stringContaining("customerId")
    })
  );
});

it("fails the batch when an invalid record can't be quarantined", async () => {
  const { customerId: _, ...missingCustomer } = confirmed;
  sqs.on(SendMessageCommand).rejects(new Error("Queue unavailable"));

  await expect(run(record("1", missingCustomer, placed))).rejects.toThrow("Queue unavailable");
});

it("reports entries that EventBridge failed to accept", async () => {
  eventBridge.on(PutEventsCommand).resolves({
    FailedEntryCount: 1,
    Entries: [{ EventId: crypto.randomUUID() }, { ErrorCode: "InternalFailure", ErrorMessage: "Try again" }]
  });

  await expect(run(record("1", placed), record("2", confirmed, placed))).resolves.toEqual({
    batchItemFailures: [{ itemIdentifier: "2" }]
  });
});
