import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import type { SESEvent } from "aws-lambda";

import { hasErrorName } from "./helpers";

const { FORWARD_BUCKET_NAME, FORWARD_KEY_PREFIX, FORWARD_FROM, FORWARD_TO } = process.env;

const s3 = new S3Client({});
const ses = new SESv2Client({});

const REPLACED_HEADERS = new Set(["from", "reply-to", "return-path", "sender", "message-id", "dkim-signature"]);

const splitMessage = (raw: Buffer) => {
  for (const separator of ["\r\n\r\n", "\n\n"]) {
    const index = raw.indexOf(separator);
    if (index !== -1) {
      return { headers: raw.subarray(0, index).toString("utf8"), body: raw.subarray(index) };
    }
  }
  return { headers: raw.toString("utf8"), body: Buffer.alloc(0) };
};

const parseHeaders = (headers: string) =>
  headers
    .split(/\r?\n/)
    .reduce<string[]>((fields, line) => {
      if (/^[ \t]/.test(line) && fields.length > 0) {
        fields[fields.length - 1] += `\r\n${line}`;
      } else {
        fields.push(line);
      }
      return fields;
    }, [])
    .map(field => {
      const colon = field.indexOf(":");
      return { name: field.slice(0, colon).trim().toLowerCase(), field, value: field.slice(colon + 1).trim() };
    });

const senderAddress = (from: string) =>
  (/<([^>]+)>/.exec(from)?.[1] ?? from).replace(/["\\\r\n]/g, "").trim() || "Unknown sender";

const rewriteMessage = (raw: Buffer) => {
  const { headers, body } = splitMessage(raw);
  const fields = parseHeaders(headers);
  const original = (name: string) => fields.find(header => header.name === name)?.value;
  const from = original("from") ?? "";
  const replyTo = original("reply-to") ?? from;

  const kept = fields.filter(({ name }) => !REPLACED_HEADERS.has(name)).map(({ field }) => field);
  const added = [`From: "${senderAddress(from)} via Malo Mart" <${FORWARD_FROM}>`];
  if (replyTo) {
    added.push(`Reply-To: ${replyTo}`);
  }

  return Buffer.concat([Buffer.from([...added, ...kept].join("\r\n")), body]);
};

export const handler = async (event: SESEvent) => {
  for (const { ses: message } of event.Records) {
    const { messageId } = message.mail;
    const { spamVerdict, virusVerdict } = message.receipt;
    if (spamVerdict.status === "FAIL" || virusVerdict.status === "FAIL") {
      console.warn(`Dropping message ${messageId}: spam ${spamVerdict.status}, virus ${virusVerdict.status}.`);
      continue;
    }

    const { Body } = await s3.send(
      new GetObjectCommand({ Bucket: FORWARD_BUCKET_NAME, Key: `${FORWARD_KEY_PREFIX}${messageId}` })
    );
    const raw = Buffer.from(await Body!.transformToByteArray());

    try {
      await ses.send(
        new SendEmailCommand({
          Destination: { ToAddresses: [FORWARD_TO!] },
          Content: { Raw: { Data: rewriteMessage(raw) } }
        })
      );
    } catch (err) {
      if (hasErrorName(err, "MessageRejected")) {
        console.warn(`SES rejected forwarding message ${messageId}.`, err);
        continue;
      }
      throw err;
    }
  }
};
