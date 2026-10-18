import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { IMAGE_WIDTHS, MAX_UPLOAD_BYTES, s3Client } from "@mm/clients/s3";
import { ImageUploadStatus } from "@mm/lib/products";
import { mockClient } from "aws-sdk-client-mock";
import sharp from "sharp";

import { handler } from "../../../src/lambdas/imageProcessor";
import { awsError } from "../../helpers/lambda";

const db = mockClient(dbClient());
const s3 = mockClient(s3Client());

const productId = crypto.randomUUID();
const uploadId = crypto.randomUUID();
const uploadKey = `products/${productId}/${uploadId}`;

const objectCreated = (key = uploadKey, size = 1024) =>
  ({
    detail: { bucket: { name: "uploads" }, object: { key, size } }
  }) as Parameters<typeof handler>[0];

const body = (data: Buffer) => ({ transformToByteArray: () => new Uint8Array(data) });

const productUpdates = () => db.commandCalls(UpdateCommand).filter(call => call.args[0].input.TableName === "products");

const statusUpdates = () =>
  db.commandCalls(UpdateCommand).filter(call => call.args[0].input.TableName === "image-uploads");

const storedImageKey = () => {
  const key = s3.commandCalls(PutObjectCommand)[0].args[0].input.Key!;
  return /^images\/(products\/[^/]+\/[0-9a-f]{16})-\d+\.webp$/.exec(key)![1];
};

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
  const imageKey = storedImageKey();
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
    UpdateExpression: "ADD imageKeys :newKeys SET thumbnailKey = if_not_exists(thumbnailKey, :imageKey)",
    ExpressionAttributeValues: { ":newKeys": new Set([imageKey]), ":imageKey": imageKey }
  });
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it("marks the upload ready with its image key", async () => {
  await handler(objectCreated());

  const imageKey = storedImageKey();
  expect(statusUpdates()).toHaveLength(1);
  expect(statusUpdates()[0].args[0].input).toMatchObject({
    Key: { id: uploadId },
    ConditionExpression: "attribute_exists(id)",
    ExpressionAttributeValues: { ":status": ImageUploadStatus.Ready, ":imageKey": imageKey }
  });
});

it("marks the upload as a duplicate when the product already has the image", async () => {
  db.on(UpdateCommand, { TableName: "products" }).callsFake(input => ({
    Attributes: { imageKeys: new Set([input.ExpressionAttributeValues[":imageKey"]]) }
  }));

  await handler(objectCreated());

  expect(statusUpdates()[0].args[0].input.ExpressionAttributeValues).toEqual({
    ":status": ImageUploadStatus.Duplicate,
    ":imageKey": storedImageKey()
  });
});

it("marks the upload ready when the product only has other images", async () => {
  db.on(UpdateCommand, { TableName: "products" }).resolves({
    Attributes: { imageKeys: new Set([`products/${productId}/ffffffffffffffff`]) }
  });

  await handler(objectCreated());

  expect(statusUpdates()[0].args[0].input.ExpressionAttributeValues).toMatchObject({
    ":status": ImageUploadStatus.Ready
  });
});

it("ignores uploads that have no status record", async () => {
  db.on(UpdateCommand, { TableName: "image-uploads" }).rejects(awsError("ConditionalCheckFailedException"));

  await expect(handler(objectCreated())).resolves.toBeUndefined();

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

it("rejects and discards uploads that are not images", async () => {
  s3.on(GetObjectCommand).callsFake(() => ({ Body: body(Buffer.from("definitely not a png")) }) as never);

  await handler(objectCreated());

  expect(s3).not.toHaveReceivedCommand(PutObjectCommand);
  expect(productUpdates()).toHaveLength(0);
  expect(statusUpdates()[0].args[0].input).toMatchObject({
    Key: { id: uploadId },
    ExpressionAttributeValues: { ":status": ImageUploadStatus.Rejected }
  });
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it("rejects and discards an oversized upload without reading it", async () => {
  await handler(objectCreated(uploadKey, MAX_UPLOAD_BYTES + 1));

  expect(s3).not.toHaveReceivedCommand(GetObjectCommand);
  expect(productUpdates()).toHaveLength(0);
  expect(statusUpdates()[0].args[0].input.ExpressionAttributeValues).toEqual({
    ":status": ImageUploadStatus.Rejected
  });
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it.each([
  ["an unexpected prefix", `misc/${crypto.randomUUID()}`],
  ["a key without an upload ID", `products/${productId}`]
])("discards %s without reading it or recording a status", async (_, key) => {
  await handler(objectCreated(key));

  expect(s3).not.toHaveReceivedCommand(GetObjectCommand);
  expect(db).not.toHaveReceivedAnyCommand();
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: key });
});

it("removes the variants and rejects the upload when the product no longer exists", async () => {
  db.on(UpdateCommand, { TableName: "products" }).rejects(awsError("ConditionalCheckFailedException"));

  await handler(objectCreated());

  const deleted = s3.commandCalls(DeleteObjectsCommand)[0].args[0].input;
  expect(deleted.Bucket).toBe("images");
  expect(deleted.Delete!.Objects).toHaveLength(IMAGE_WIDTHS.length);
  expect(statusUpdates()[0].args[0].input.ExpressionAttributeValues).toEqual({
    ":status": ImageUploadStatus.Rejected
  });
  expect(s3).toHaveReceivedCommandWith(DeleteObjectCommand, { Bucket: "uploads", Key: uploadKey });
});

it("rethrows other errors and keeps the upload for a retry", async () => {
  db.on(UpdateCommand, { TableName: "products" }).rejects(awsError("ThrottlingException"));

  await expect(handler(objectCreated())).rejects.toThrow("ThrottlingException");

  expect(statusUpdates()).toHaveLength(0);
  expect(s3).not.toHaveReceivedCommand(DeleteObjectCommand);
});

it("keeps the upload for a retry when the status can't be recorded", async () => {
  db.on(UpdateCommand, { TableName: "image-uploads" }).rejects(awsError("ThrottlingException"));

  await expect(handler(objectCreated())).rejects.toThrow("ThrottlingException");

  expect(s3).not.toHaveReceivedCommand(DeleteObjectCommand);
});
