import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export type UploadUrlOptions = {
  contentType?: string;
  expireSeconds?: number;
};
export type DownloadUrlOptions = {
  contentDisposition?: "inline" | "attachment";
  expireSeconds?: number;
};

const DEFAULT_PRESIGNED_UPLOAD_EXPIRE_SECONDS = 300;
const DEFAULT_PRESIGNED_DOWNLOAD_EXPIRE_SECONDS = 3600;

let baseClient: S3Client;
export const s3Client = () => {
  baseClient ??= new S3Client({});
  return baseClient;
};

export const getUploadUrl = (client: S3Client, bucket: string, key: string, opts?: UploadUrlOptions) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: opts?.contentType
  });
  return getSignedUrl(client, command, {
    expiresIn: opts?.expireSeconds ?? DEFAULT_PRESIGNED_UPLOAD_EXPIRE_SECONDS,
    signableHeaders: new Set(["content-type"])
  });
};

export const getDownloadUrl = (client: S3Client, bucket: string, key: string, opts?: DownloadUrlOptions) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: opts?.contentDisposition ?? "inline"
  });
  return getSignedUrl(client, command, {
    expiresIn: opts?.expireSeconds ?? DEFAULT_PRESIGNED_DOWNLOAD_EXPIRE_SECONDS
  });
};
