import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { MAX_UPLOAD_BYTES } from "@mm/clients";

import { getPresignedPost } from "@/utils/uploads";

vi.mock("@aws-sdk/s3-presigned-post", () => ({
  createPresignedPost: vi.fn()
}));

const client = new S3Client({ region: "us-east-1" });
const signed = { url: "https://bucket.s3.amazonaws.com/", fields: { key: "products/1/upload" } };

const lastOptions = () => {
  const [signingClient, options] = vi.mocked(createPresignedPost).mock.lastCall!;
  return { signingClient, options };
};

beforeEach(() => {
  vi.mocked(createPresignedPost).mockResolvedValue(signed);
});

describe("getPresignedPost", () => {
  it("locks the content type to the provided image type", async () => {
    await expect(getPresignedPost(client, "bucket", "products/1/upload", "image/png")).resolves.toBe(signed);

    const { signingClient, options } = lastOptions();
    expect(signingClient).toBe(client);
    expect(options).toEqual({
      Bucket: "bucket",
      Key: "products/1/upload",
      Conditions: [["content-length-range", 1, MAX_UPLOAD_BYTES]],
      Fields: { "Content-Type": "image/png" },
      Expires: 300
    });
  });

  it.each([
    ["no content type", undefined],
    ["a non-image content type", "application/pdf"]
  ])("allows any image type when given %s", async (_, contentType) => {
    await getPresignedPost(client, "bucket", "products/1/upload", contentType);

    const { options } = lastOptions();
    expect(options.Conditions).toEqual([
      ["content-length-range", 1, MAX_UPLOAD_BYTES],
      ["starts-with", "$Content-Type", "image/"]
    ]);
    expect(options.Fields).toBeUndefined();
  });
});
