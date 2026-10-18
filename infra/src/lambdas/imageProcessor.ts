import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { IMAGE_WIDTHS, imageHash, imageVariantKey, MAX_UPLOAD_BYTES, productImageKey, s3Client } from "@mm/clients/s3";
import { ImageUploadStatus } from "@mm/lib/products";
import type { S3ObjectCreatedNotificationEvent } from "aws-lambda";
import sharp from "sharp";

import { hasErrorName } from "./helpers";

const { IMAGE_BUCKET_NAME, IMAGE_UPLOADS_TABLE_NAME, PRODUCTS_TABLE_NAME } = process.env;

const UPLOAD_KEY_PATTERN = /^products\/([^/]+)\/([^/]+)$/;

const setUploadStatus = async (uploadId: string, status: ImageUploadStatus, imageKey?: string) => {
  try {
    await dbClient().send(
      new UpdateCommand({
        TableName: IMAGE_UPLOADS_TABLE_NAME,
        Key: { id: uploadId },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: imageKey ? "SET #status = :status, imageKey = :imageKey" : "SET #status = :status",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":status": status, ...(imageKey ? { ":imageKey": imageKey } : {}) }
      })
    );
  } catch (err) {
    if (!hasErrorName(err, "ConditionalCheckFailedException")) {
      throw err;
    }
  }
};

export const handler = async (event: S3ObjectCreatedNotificationEvent) => {
  const bucket = event.detail.bucket.name;
  const { key: uploadKey, size } = event.detail.object;
  const s3 = s3Client();
  const discardUpload = () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: uploadKey }));

  const [, productId, uploadId] = UPLOAD_KEY_PATTERN.exec(uploadKey) ?? [];
  if (!productId || !uploadId) {
    console.warn(`Rejecting upload ${uploadKey} (${size} bytes).`);
    await discardUpload();
    return;
  }
  const reject = async (reason: string, err?: unknown) => {
    console.warn(`Rejecting upload ${uploadKey}: ${reason}`, ...(err ? [err] : []));
    await setUploadStatus(uploadId, ImageUploadStatus.Rejected);
    await discardUpload();
  };

  if (size > MAX_UPLOAD_BYTES) {
    await reject(`${size} bytes is over the limit.`);
    return;
  }

  const upload = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: uploadKey }));
  const input = Buffer.from(await upload.Body!.transformToByteArray());

  let variants: { width: number; data: Buffer }[];
  try {
    const image = sharp(input, { failOn: "error" }).rotate();
    variants = await Promise.all(
      IMAGE_WIDTHS.map(async width => ({
        width,
        data: await image.clone().resize({ width, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
      }))
    );
  } catch (err) {
    await reject("not a readable image.", err);
    return;
  }

  const imageKey = productImageKey(productId, imageHash(input));

  await Promise.all(
    variants.map(({ width, data }) =>
      s3.send(
        new PutObjectCommand({
          Bucket: IMAGE_BUCKET_NAME,
          Key: imageVariantKey(imageKey, width),
          Body: data,
          ContentType: "image/webp",
          CacheControl: "public, max-age=31536000, immutable"
        })
      )
    )
  );

  let existingKeys: Set<string> | undefined;
  try {
    const { Attributes } = await dbClient().send(
      new UpdateCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Key: { id: productId },
        UpdateExpression: "ADD imageKeys :newKeys SET thumbnailKey = if_not_exists(thumbnailKey, :imageKey)",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeValues: { ":newKeys": new Set([imageKey]), ":imageKey": imageKey },
        ReturnValues: "UPDATED_OLD"
      })
    );
    existingKeys = Attributes?.imageKeys as Set<string> | undefined;
  } catch (err) {
    if (!hasErrorName(err, "ConditionalCheckFailedException")) {
      throw err;
    }
    console.warn(`Product ${productId} no longer exists; discarding image ${imageKey}.`);
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: IMAGE_BUCKET_NAME,
        Delete: { Objects: IMAGE_WIDTHS.map(width => ({ Key: imageVariantKey(imageKey, width) })) }
      })
    );
    await setUploadStatus(uploadId, ImageUploadStatus.Rejected);
    await discardUpload();
    return;
  }

  const status = existingKeys?.has(imageKey) ? ImageUploadStatus.Duplicate : ImageUploadStatus.Ready;
  await setUploadStatus(uploadId, status, imageKey);
  await discardUpload();
};
