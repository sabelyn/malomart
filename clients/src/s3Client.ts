import { S3Client } from "@aws-sdk/client-s3";
import type { infer as zinfer } from "zod";
import { strictObject, string } from "zod";

export const BucketNames = strictObject({
  image: string().nonempty().optional(),
  uploadStaging: string().nonempty().optional()
});
export type BucketNames = zinfer<typeof BucketNames>;

export const IMAGE_WIDTHS = [320, 640, 1280];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

let baseClient: S3Client;
export const s3Client = () => {
  baseClient ??= new S3Client({});
  return baseClient;
};

export const IMAGE_KEY_PREFIX = "images/";
export const imageVariantKey = (imageKey: string, width: number) => `${IMAGE_KEY_PREFIX}${imageKey}-${width}.webp`;
