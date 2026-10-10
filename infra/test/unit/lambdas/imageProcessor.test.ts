import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { IMAGE_WIDTHS, MAX_UPLOAD_BYTES, s3Client } from "@mm/clients/s3";
import { mockClient } from "aws-sdk-client-mock";
import sharp from "sharp";

import { handler } from "../../../src/lambdas/imageProcessor";
import { awsError } from "../../helpers/lambda";

const db = mockClient(dbClient());
const s3 = mockClient(s3Client());

const productId = crypto.randomUUID();
const uploadKey = `products/${productId}/${crypto.randomUUID()}`;

const objectCreated = (key = uploadKey, size = 1024) =>
  ({
    detail: { bucket: { name: "uploads" }, object: { key, size } }
  }) as Parameters<typeof handler>[0];

const body = (data: Buffer) => ({ transformToByteArray: () => new Uint8Array(data) });

let png: Buffer;
beforeAll(async () => {
  png = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#e86c98" } })
    .png()
    .toBuffer();
});

beforeEach(() => {
  db.reset();
  s3.reset();
  s3.on(GetObjectCommand).callsFake(() => ({ Body: body(png) }) as never);
  db.on(UpdateCommand).resolves({});
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

it("writes immutable webp variants, adds the image key, and discards the upload", async () => {
  await handler(objectCreated());

  const puts = s3.commandCalls(PutObjectCommand).map(call => call.args[0].input);
  expect(puts).toHaveLength(IMAGE_WIDTHS.length);
  const imageKey = /^images\/(products\/[^/]+\/[0-9a-f]{16})-\d+\.webp$/.exec(puts[0].Key!)![1];
  expect(imageKey.startsWith(`products/${productId}/`)).toBe(true);

  for (const width of IMAGE_WIDTHS) {
    const put = puts.find(input => input.Key === `images/${imageKey}-${width}.webp`)!;
    expect(put).toMatchObject({
      Bucket: "images",
      ContentType: "image/webp",
      CacheControl: "public, max-age=31536000, immutable"
    });
    const meta = await sharp(put.Body as Buffer).metadata();
    expect(meta).toMatchObject({ format: "webp", width });
  }

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: "products",
    Key: { id: productId },
    UpdateExpression: "ADD imageKeys :newKeys",
    ExpressionAttributeValues: { ":newKeys": new Set([imageKey]) }
  });
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it("does not upscale images smaller than a variant width", async () => {
  const small = await sharp({ create: { width: 500, height: 500, channels: 3, background: "#edc04e" } })
    .png()
    .toBuffer();
  s3.on(GetObjectCommand).callsFake(() => ({ Body: body(small) }) as never);

  await handler(objectCreated());

  const widths = await Promise.all(
    s3
      .commandCalls(PutObjectCommand)
      .map(async call => (await sharp(call.args[0].input.Body as Buffer).metadata()).width)
  );
  expect(widths.sort((a, b) => a - b)).toEqual([320, 500, 500]);
});

it("discards uploads that are not images", async () => {
  s3.on(GetObjectCommand).callsFake(() => ({ Body: body(Buffer.from("definitely not a png")) }) as never);

  await handler(objectCreated());

  expect(s3).not.toHaveReceivedCommand(PutObjectCommand);
  expect(db).not.toHaveReceivedAnyCommand();
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it.each([
  ["an unexpected key", `misc/${crypto.randomUUID()}`, 1024],
  ["an oversized upload", uploadKey, MAX_UPLOAD_BYTES + 1]
])("discards %s without reading it", async (_, key, size) => {
  await handler(objectCreated(key, size));

  expect(s3).not.toHaveReceivedCommand(GetObjectCommand);
  expect(db).not.toHaveReceivedAnyCommand();
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: key });
});

it("removes the variants when the product no longer exists", async () => {
  db.on(UpdateCommand).rejects(awsError("ConditionalCheckFailedException"));

  await handler(objectCreated());

  const deleted = s3.commandCalls(DeleteObjectsCommand)[0].args[0].input;
  expect(deleted.Bucket).toBe("images");
  expect(deleted.Delete!.Objects).toHaveLength(IMAGE_WIDTHS.length);
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it("rethrows other errors and keeps the upload for a retry", async () => {
  db.on(UpdateCommand).rejects(awsError("ThrottlingException"));

  await expect(handler(objectCreated())).rejects.toThrow("ThrottlingException");

  expect(s3).not.toHaveReceivedCommand(DeleteObjectCommand);
});
