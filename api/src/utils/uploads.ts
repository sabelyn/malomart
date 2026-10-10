import type { S3Client } from "@aws-sdk/client-s3";
import type { PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_UPLOAD_BYTES } from "@mm/clients";

const UPLOAD_EXPIRE_SECONDS = 300;
export const getPresignedPost = (client: S3Client, bucket: string, key: string, contentType?: string) => {
  const hasContentType = contentType && contentType.toLowerCase().startsWith("image/");
  const Conditions: PresignedPostOptions["Conditions"] = [["content-length-range", 1, MAX_UPLOAD_BYTES]];
  if (!hasContentType) {
    Conditions.push(["starts-with", "$Content-Type", "image/"]);
  }
  const Fields = hasContentType ? { "Content-Type": contentType } : undefined;

  return createPresignedPost(client, {
    Bucket: bucket,
    Key: key,
    Conditions,
    Fields,
    Expires: UPLOAD_EXPIRE_SECONDS
  });
};
