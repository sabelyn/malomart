import { imageVariantKey, s3Client } from "../../src/s3Client";

describe("s3Client", () => {
  it("returns the same instance on repeated calls", () => {
    expect(s3Client()).toBe(s3Client());
  });
});

describe("imageVariantKey", () => {
  it("builds the public key for a variant width", () => {
    expect(imageVariantKey("products/1/abc", 640)).toBe("images/products/1/abc-640.webp");
  });
});
