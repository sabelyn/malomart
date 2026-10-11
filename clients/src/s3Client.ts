import { S3Client } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";
import type { infer as zinfer } from "zod";
import { strictObject, string } from "zod";

export { IMAGE_KEY_PREFIX, IMAGE_WIDTHS, imageVariantKey } from "@mm/lib/products";

export const BucketNames = strictObject({
  image: string().nonempty(),
  uploadStaging: string().nonempty()
});
export type BucketNames = zinfer<typeof BucketNames>;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

let baseClient: S3Client;
export const s3Client = () => {
  baseClient ??= new S3Client({});
  return baseClient;
};

export const imageHash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex").slice(0, 16);
export const productImageKey = (productId: string, hash: string) => `products/${productId}/${hash}`;
