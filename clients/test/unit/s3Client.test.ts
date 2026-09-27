import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getDownloadUrl, getUploadUrl, s3Client } from "../../src/s3Client";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn()
}));

const client = new S3Client({ region: "us-east-1" });

const lastSignCall = () => {
  const [signingClient, command, options] = vi.mocked(getSignedUrl).mock.lastCall!;
  return { signingClient, command, options };
};

beforeEach(() => {
  vi.mocked(getSignedUrl).mockResolvedValue("https://signed.example");
});

describe("s3Client", () => {
  it("returns the same instance on repeated calls", () => {
    expect(s3Client()).toBe(s3Client());
  });
});

describe("getUploadUrl", () => {
  it("signs a PutObject for the bucket and key with defaults", async () => {
    const url = await getUploadUrl(client, "bucket", "path/file.png");

    const { signingClient, command, options } = lastSignCall();
    expect(url).toBe("https://signed.example");
    expect(signingClient).toBe(client);
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({ Bucket: "bucket", Key: "path/file.png", ContentType: undefined });
    expect(options).toEqual({ expiresIn: 300, signableHeaders: new Set(["content-type"]) });
  });

  it("applies content type and expiry options", async () => {
    await getUploadUrl(client, "bucket", "file.png", { contentType: "image/png", expireSeconds: 60 });

    const { command, options } = lastSignCall();
    expect(command.input).toMatchObject({ ContentType: "image/png" });
    expect(options).toMatchObject({ expiresIn: 60 });
  });
});

describe("getDownloadUrl", () => {
  it("signs a GetObject for the bucket and key with defaults", async () => {
    const url = await getDownloadUrl(client, "bucket", "path/file.png");

    const { signingClient, command, options } = lastSignCall();
    expect(url).toBe("https://signed.example");
    expect(signingClient).toBe(client);
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input).toEqual({ Bucket: "bucket", Key: "path/file.png", ResponseContentDisposition: "inline" });
    expect(options).toEqual({ expiresIn: 3600 });
  });

  it("applies disposition and expiry options", async () => {
    await getDownloadUrl(client, "bucket", "file.png", { contentDisposition: "attachment", expireSeconds: 30 });

    const { command, options } = lastSignCall();
    expect(command.input).toMatchObject({ ResponseContentDisposition: "attachment" });
    expect(options).toEqual({ expiresIn: 30 });
  });
});
