import type { S3Client } from "@aws-sdk/client-s3";
import { getDownloadUrl, getUploadUrl } from "@mm/clients";
import { inject } from "tsyringe";

import { S3 } from "@/contracts/tokens";

type FileUploadOptions = {
  key: string;
  contentType: string;
};

export class ImageService {
  constructor(@inject(S3) private readonly client: S3Client) {}

  getSignedUploadUrls = async (bucket: string, files: FileUploadOptions[]) => {
    const results = await Promise.allSettled(
      files.map(({ key, contentType }) => getUploadUrl(this.client, bucket, key, { contentType }))
    );

    const urls: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const key = files[i].key;
      const result = results[i];
      if ("value" in result) {
        urls[key] = result.value;
      } else {
        console.warn(`Failed to generate signed upload URL for key ${key}.`, { cause: result.reason });
      }
    }

    return urls;
  };

  getSignedDownloadUrls = async (bucket: string, keys: string[], contentDisposition: "inline" | "attachment") => {
    const results = await Promise.allSettled(
      keys.map(key => getDownloadUrl(this.client, bucket, key, { contentDisposition }))
    );

    const urls: Record<string, string> = {};
    for (let i = 0; i < results.length; i++) {
      const key = keys[i];
      const result = results[i];
      if ("value" in result) {
        urls[key] = result.value;
      } else {
        console.warn(`Failed to generate signed download URL for key ${key}.`, { cause: result.reason });
      }
    }

    return urls;
  };
}
