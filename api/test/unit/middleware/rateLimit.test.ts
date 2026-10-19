import { ErrorCode } from "@mm/lib";
import express from "express";
import type { Request, RequestHandler } from "express";
import request from "supertest";

import { error } from "@/middleware/error";
import { clientIp, sendCodeLimit, verifyCodeLimit } from "@/middleware/rateLimit";

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

let nextAddress = 0;
const uniqueViewerAddress = () => {
  nextAddress++;
  return `203.0.113.${nextAddress}:${40000 + nextAddress}`;
};

const createApp = (limit: RequestHandler) => {
  const app = express();
  app.post("/", limit, (_req, res) => res.sendStatus(204));
  app.use(error);
  return app;
};

const sendRequests = async (app: express.Express, viewerAddress: string, count: number) => {
  const statuses: number[] = [];
  for (let i = 0; i < count; i++) {
    const res = await request(app).post("/").set("CloudFront-Viewer-Address", viewerAddress);
    statuses.push(res.status);
  }
  return statuses;
};

describe.each([
  ["sendCodeLimit", sendCodeLimit, 10],
  ["verifyCodeLimit", verifyCodeLimit, 20]
])("%s", (_, limit, max) => {
  const app = createApp(limit);

  it(`allows ${max} requests from the same viewer`, async () => {
    const statuses = await sendRequests(app, uniqueViewerAddress(), max);

    expect(statuses.every(status => status === 204)).toBe(true);
  });

  it("rejects requests past the limit with a rate limited error", async () => {
    const viewerAddress = uniqueViewerAddress();
    await sendRequests(app, viewerAddress, max);

    const res = await request(app).post("/").set("CloudFront-Viewer-Address", viewerAddress);

    expect(res.status).toBe(429);
    expect(res.body).toMatchObject({ code: ErrorCode.RateLimited });
  });

  it("limits each viewer separately", async () => {
    await sendRequests(app, uniqueViewerAddress(), max + 1);

    const res = await request(app).post("/").set("CloudFront-Viewer-Address", uniqueViewerAddress());

    expect(res.status).toBe(204);
  });

  it("keys on the viewer IP rather than its port", async () => {
    const viewerAddress = uniqueViewerAddress();
    await sendRequests(app, viewerAddress, max);
    const ip = viewerAddress.slice(0, viewerAddress.lastIndexOf(":"));

    const res = await request(app).post("/").set("CloudFront-Viewer-Address", `${ip}:1`);

    expect(res.status).toBe(429);
  });
});
