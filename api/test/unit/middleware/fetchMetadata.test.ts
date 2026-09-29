import { ErrorCode } from "@mm/lib";
import type { Request, Response } from "express";

import { ApiError } from "@/errors/ApiError";
import { fetchMetadata } from "@/middleware/fetchMetadata";

const mockRequest = (method: string, site?: string) =>
  ({
    method,
    get: vi.fn((name: string) => (name.toLowerCase() === "sec-fetch-site" ? site : undefined))
  }) as unknown as Request;

const run = (method: string, site?: string) => {
  const next = vi.fn();
  fetchMetadata(mockRequest(method, site), {} as Response, next);
  return next;
};

describe("fetchMetadata", () => {
  it.each(["GET", "HEAD", "OPTIONS"])("allows cross-site %s requests", method => {
    expect(run(method, "cross-site")).toHaveBeenCalledOnce();
  });

  it.each([
    ["without the header", undefined],
    ["from the same origin", "same-origin"],
    ["initiated by the user", "none"]
  ])("allows unsafe requests %s", (_, site) => {
    expect(run("POST", site)).toHaveBeenCalledOnce();
  });

  it.each(["cross-site", "same-site"])("rejects unsafe %s requests with a 403", site => {
    const next = vi.fn();

    expect(() => fetchMetadata(mockRequest("DELETE", site), {} as Response, next)).toThrow(ApiError);
    expect(() => fetchMetadata(mockRequest("POST", site), {} as Response, next)).toThrow(
      expect.objectContaining({ statusCode: 403, code: ErrorCode.CrossSiteRequest })
    );
    expect(next).not.toHaveBeenCalled();
  });
});
