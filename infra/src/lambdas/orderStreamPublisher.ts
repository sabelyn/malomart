import type { PutEventsRequestEntry } from "@aws-sdk/client-eventbridge";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { ORDER_EVENT_SOURCE, OrderEventType, OrderStatusChangedDetail } from "@mm/lib/orders";
import type { DynamoDBBatchItemFailure, DynamoDBRecord, DynamoDBStreamHandler } from "aws-lambda";
import { z, ZodError } from "zod";

const { EVENT_BUS_NAME, INVALID_RECORDS_QUEUE_URL } = process.env;

const eventBridge = new EventBridgeClient({});
const sqs = new SQSClient({});

const toDetail = (record: DynamoDBRecord): OrderStatusChangedDetail | null => {
  const { NewImage, OldImage } = record.dynamodb ?? {};
  const status = NewImage?.currentStatus?.S;
  const previousStatus = OldImage?.currentStatus?.S ?? null;
  if (!NewImage || !status || status === previousStatus) {
    return null;
  }

  return OrderStatusChangedDetail.parse({
    orderId: NewImage.id?.S,
    customerId: NewImage.customerId?.S,
    previousStatus,
    status,
    at: NewImage.statusUpdates?.M?.[status]?.S
  });
};

const quarantine = (record: DynamoDBRecord, error: ZodError) =>
  sqs.send(
    new SendMessageCommand({
      QueueUrl: INVALID_RECORDS_QUEUE_URL,
      MessageBody: JSON.stringify({
        eventID: record.eventID,
        eventName: record.eventName,
        sequenceNumber: record.dynamodb?.SequenceNumber,
        keys: record.dynamodb?.Keys,
        error: z.prettifyError(error),
        newImage: record.dynamodb?.NewImage,
        oldImage: record.dynamodb?.OldImage
      })
    })
  );

export const handler: DynamoDBStreamHandler = async event => {
  const batchItemFailures: DynamoDBBatchItemFailure[] = [];
  const published: { sequenceNumber: string; entry: PutEventsRequestEntry }[] = [];

  for (const record of event.Records) {
    const sequenceNumber = record.dynamodb!.SequenceNumber!;
    try {
      const detail = toDetail(record);
      if (detail) {
        published.push({
          sequenceNumber,
          entry: {
            EventBusName: EVENT_BUS_NAME,
            Source: ORDER_EVENT_SOURCE,
            DetailType: OrderEventType.StatusChanged,
            Detail: JSON.stringify(detail)
          }
        });
      }
    } catch (err) {
      if (!(err instanceof ZodError)) {
        throw err;
      }
      console.error(`Invalid order stream record ${sequenceNumber}.`, err);
      await quarantine(record, err);
    }
  }

  if (published.length > 0) {
    const { Entries } = await eventBridge.send(
      new PutEventsCommand({ Entries: published.map(({ entry }) => entry) })
    );
    Entries?.forEach((result, i) => {
      if (result.ErrorCode) {
        console.error(`Failed to publish order event for record ${published[i].sequenceNumber}.`, result);
        batchItemFailures.push({ itemIdentifier: published[i].sequenceNumber });
      }
    });
  }

  return { batchItemFailures };
};
