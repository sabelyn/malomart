import type { _Object } from "@aws-sdk/client-s3";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import type { AddressObject, ParsedMail } from "mailparser";
import { simpleParser } from "mailparser";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

const usage = `Usage:
  pnpm inbox [options]
    Prints the newest message received by the test inbox. Any address at the inbox domain works,
    so give each test or flow its own, like signup-1234@inbox.malomart.link.
    --to <address>      Only messages sent to this address.
    --wait <seconds>    Wait up to this long for a new message to arrive instead of reading old ones.
    --list              List recent messages instead of printing one.
    --help              Show this message.`;

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUTPUTS_FILE = path.join(ROOT, "local/domain-outputs.json");
const KEY_PREFIX = "mail/";
const SCAN_LIMIT = 25;
const POLL_INTERVAL_MS = 3000;

const s3 = new S3Client({});

const loadBucket = async () => {
  let outputs: Record<string, Record<string, string>>;
  try {
    outputs = JSON.parse(await readFile(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:domain" first.`, { cause: err });
  }
  const bucket = outputs.MaloMartMail?.InboxBucketName;
  if (!bucket) {
    throw new Error(`No inbox bucket for MaloMartMail in ${OUTPUTS_FILE}. Run "pnpm deploy:domain".`);
  }
  return bucket;
};

const listNewest = async (Bucket: string, since?: Date) => {
  const objects: _Object[] = [];
  let ContinuationToken: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket, Prefix: KEY_PREFIX, ContinuationToken }));
    objects.push(...(page.Contents ?? []));
    ContinuationToken = page.NextContinuationToken;
  } while (ContinuationToken);

  return objects
    .filter(obj => obj.Key !== `${KEY_PREFIX}AMAZON_SES_SETUP_NOTIFICATION`)
    .filter(obj => !since || (obj.LastModified && obj.LastModified >= since))
    .sort((a, b) => (b.LastModified?.getTime() ?? 0) - (a.LastModified?.getTime() ?? 0))
    .slice(0, SCAN_LIMIT);
};

const readMessage = async (Bucket: string, Key: string) => {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket, Key }));
  if (!Body) {
    throw new Error(`Message ${Key} has no body.`);
  }
  return simpleParser(Buffer.from(await Body.transformToByteArray()));
};

const addresses = (field?: AddressObject | AddressObject[]) =>
  [field ?? []].flat().flatMap(obj => obj.value.map(({ address }) => address?.toLowerCase() ?? ""));

const isTo = (mail: ParsedMail, to?: string) => !to || addresses(mail.to).includes(to.toLowerCase());

const findMessage = async (Bucket: string, to?: string, since?: Date) => {
  for (const obj of await listNewest(Bucket, since)) {
    const mail = await readMessage(Bucket, obj.Key!);
    if (isTo(mail, to)) return mail;
  }
  return undefined;
};

const summary = (mail: ParsedMail) =>
  [
    `From: ${mail.from?.text ?? ""}`,
    `To: ${addresses(mail.to).join(", ")}`,
    `Date: ${mail.date?.toISOString() ?? ""}`,
    `Subject: ${mail.subject ?? ""}`
  ].join("\n");

const bodyText = (mail: ParsedMail) =>
  (mail.text || (mail.html || "").replace(/<br\s*\/?>|<\/(p|div|tr|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")).trim();

const main = async () => {
  const { values: args } = parseArgs({
    options: {
      to: { type: "string" },
      wait: { type: "string" },
      list: { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (args.help) {
    console.log(usage);
    return;
  }

  const bucket = await loadBucket();

  if (args.list) {
    const objects = await listNewest(bucket);
    const mails = await Promise.all(objects.map(obj => readMessage(bucket, obj.Key!)));
    const matching = mails.filter(mail => isTo(mail, args.to));
    console.log(matching.length ? matching.map(summary).join("\n\n") : "No messages.");
    return;
  }

  let mail: ParsedMail | undefined;
  if (args.wait) {
    const since = new Date(Date.now() - POLL_INTERVAL_MS);
    const deadline = Date.now() + Number(args.wait) * 1000;
    while (!mail && Date.now() < deadline) {
      mail = await findMessage(bucket, args.to, since);
      if (!mail) await sleep(POLL_INTERVAL_MS);
    }
  } else {
    mail = await findMessage(bucket, args.to);
  }

  if (!mail) {
    console.log(args.wait ? "No new message arrived in time." : "No messages.");
    process.exitCode = 1;
    return;
  }
  console.log(`${summary(mail)}\n\n${bodyText(mail)}`);
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
