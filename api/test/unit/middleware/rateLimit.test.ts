import type { Request } from "express";

import { clientIp } from "@/middleware/rateLimit";

const mockRequest = (viewerAddress?: string, ip?: string) =>
  ({
    ip,
    get: vi.fn((name: string) => (name.toLowerCase() === "cloudfront-viewer-address" ? viewerAddress : undefined))
  }) as unknown as Request;

describe("clientIp", () => {
  it.each([
    ["an IPv4 viewer address", "198.51.100.10:46532", "198.51.100.10"],
    ["an IPv6 viewer address", "2001:db8:85a3::8a2e:370:7334:46532", "2001:db8:85a3::8a2e:370:7334"]
  ])("takes the IP from %s", (_, viewerAddress, expected) => {
    expect(clientIp(mockRequest(viewerAddress, "10.0.0.1"))).toBe(expected);
  });

  it("falls back to the request IP without CloudFront", () => {
    expect(clientIp(mockRequest(undefined, "10.0.0.1"))).toBe("10.0.0.1");
  });
});
