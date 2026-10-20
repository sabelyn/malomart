import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { SESEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/mailForwarder";
import { awsError } from "../../helpers/lambda";

const s3 = mockClient(S3Client);
const ses = mockClient(SESv2Client);

const message = [
  "Return-Path: <zelda@hyrule.test>",
  "DKIM-Signature: v=1; a=rsa-sha256; d=hyrule.test;",
  "\tb=abc123",
  'From: "Princess Zelda" <zelda@hyrule.test>',
  "To: contact@malomart.link",
  "Subject: Please delete",
  " my data",
  "Message-ID: <original@hyrule.test>",
  "Content-Type: text/plain; charset=utf-8",
  "",
  "Hello Malo,",
  "Please remove my account."
].join("\r\n");

const eventFor = (verdicts: { spam?: string; virus?: string } = {}) =>
  ({
    Records: [
      {
        ses: {
          mail: { messageId: "message-1" },
          receipt: {
            spamVerdict: { status: verdicts.spam ?? "PASS" },
            virusVerdict: { status: verdicts.virus ?? "PASS" }
          }
        }
      }
    ]
  }) as unknown as SESEvent;

const stored = (raw: string) =>
  s3
    .on(GetObjectCommand)
    .callsFake(() => ({ Body: { transformToByteArray: () => new Uint8Array(Buffer.from(raw)) } }) as never);

const forwarded = () => {
  const { input } = ses.commandCalls(SendEmailCommand)[0].args[0];
  return { to: input.Destination?.ToAddresses, raw: Buffer.from(input.Content!.Raw!.Data!).toString("utf8") };
};

beforeEach(() => {
  s3.reset();
  ses.reset();
  stored(message);
  ses.on(SendEmailCommand).resolves({ MessageId: "sent" });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

it("forwards the stored message from the forwarding address with replies going to the sender", async () => {
  await handler(eventFor());

  expect(s3).toHaveReceivedCommandWith(GetObjectCommand, { Bucket: "inbox", Key: "forward/message-1" });
  const { to, raw } = forwarded();
  expect(to).toEqual(["owner@example.com"]);
  const [headers, body] = raw.split("\r\n\r\n");
  expect(headers.split("\r\n")).toEqual([
    'From: "zelda@hyrule.test via Malo Mart" <forwarder@malomart.test>',
    'Reply-To: "Princess Zelda" <zelda@hyrule.test>',
    "To: contact@malomart.link",
    "Subject: Please delete",
    " my data",
    "Content-Type: text/plain; charset=utf-8"
  ]);
  expect(body).toBe("Hello Malo,\r\nPlease remove my account.");
});

it("keeps the sender's own Reply-To", async () => {
  stored(message.replace("To: contact", "Reply-To: link@hyrule.test\r\nTo: contact"));

  await handler(eventFor());

  expect(forwarded().raw).toContain("\r\nReply-To: link@hyrule.test\r\n");
  expect(forwarded().raw.match(/^Reply-To:/gm)).toHaveLength(1);
});

it.each([{ spam: "FAIL" }, { virus: "FAIL" }])("drops messages SES flags: %o", async verdicts => {
  await handler(eventFor(verdicts));

  expect(s3).not.toHaveReceivedAnyCommand();
  expect(ses).not.toHaveReceivedAnyCommand();
});

it("doesn't retry messages SES rejects", async () => {
  ses.on(SendEmailCommand).rejects(awsError("MessageRejected"));

  await expect(handler(eventFor())).resolves.toBeUndefined();
});

it("fails so it is retried when sending errors otherwise", async () => {
  ses.on(SendEmailCommand).rejects(awsError("TooManyRequestsException"));

  await expect(handler(eventFor())).rejects.toThrow("TooManyRequestsException");
});
