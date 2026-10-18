import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { IMAGE_WIDTHS, imageHash, imageVariantKey, MAX_UPLOAD_BYTES, productImageKey, s3Client } from "@mm/clients/s3";
import type { S3ObjectCreatedNotificationEvent } from "aws-lambda";
import sharp from "sharp";

import { hasErrorName } from "./helpers";

const { IMAGE_BUCKET_NAME, PRODUCTS_TABLE_NAME } = process.env;

const UPLOAD_KEY_PATTERN = /^products\/([^/]+)\/[^/]+$/;

export const handler = async (event: S3ObjectCreatedNotificationEvent) => {
  const bucket = event.detail.bucket.name;
  const { key: uploadKey, size } = event.detail.object;
  const s3 = s3Client();
  const discardUpload = () => s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: uploadKey }));

  const productId = UPLOAD_KEY_PATTERN.exec(uploadKey)?.[1];
  if (!productId || size > MAX_UPLOAD_BYTES) {
    console.warn(`Rejecting upload ${uploadKey} (${size} bytes).`);
    await discardUpload();
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
    console.warn(`Rejecting upload ${uploadKey}: not a readable image.`, err);
    await discardUpload();
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

  try {
    await dbClient().send(
      new UpdateCommand({
        TableName: PRODUCTS_TABLE_NAME,
        Key: { id: productId },
        UpdateExpression: "ADD imageKeys :newKeys",
        ConditionExpression: "attribute_exists(id)",
        ExpressionAttributeValues: { ":newKeys": new Set([imageKey]) }
      })
    );
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
  }

  await discardUpload();
};
