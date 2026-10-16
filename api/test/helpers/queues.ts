import { DeleteMessageBatchCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

const drainQueue = async (sqs: SQSClient, QueueUrl: string, quietSeconds: number) => {
  for (;;) {
    const { Messages = [] } = await sqs.send(
      new ReceiveMessageCommand({ QueueUrl, MaxNumberOfMessages: 10, WaitTimeSeconds: quietSeconds })
    );
    if (Messages.length === 0) {
      return;
    }
    await sqs.send(
      new DeleteMessageBatchCommand({
        QueueUrl,
        Entries: Messages.map(({ ReceiptHandle }, i) => ({ Id: String(i), ReceiptHandle }))
      })
    );
  }
};

export const drainQueues = (queueUrls: string[], quietSeconds = 10) => {
  const sqs = new SQSClient({});
  return Promise.all(queueUrls.map(url => drainQueue(sqs, url, quietSeconds)));
};
