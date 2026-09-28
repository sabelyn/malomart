import { Endpoint, Route } from "@mm/lib/api";
import type { Response } from "express";
import { strictObject, string, ZodError } from "zod";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { requireAdmin, requireUser } from "@/middleware";
import { pathAndMiddleware, respond } from "@/routes/helpers";

const baseConfig = {
  description: "desc",
  id: "op",
  successDescription: "ok",
  summary: "sum"
};

const Result = strictObject({ name: string() });

const mockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    sendStatus: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.sendStatus.mockReturnValue(res);
  return res;
};

describe("pathAndMiddleware", () => {
  const root = new Route("/things", "public");

  it("returns only the express path for public endpoints", () => {
    const endpoint = new Endpoint(root, { ...baseConfig, method: "GET", path: "/{id}" });

    expect(pathAndMiddleware(endpoint)).toEqual(["/:id"]);
  });

  it("adds requireUser for user endpoints", () => {
    const endpoint = new Endpoint(root, { ...baseConfig, access: "user", method: "GET", path: "/" });

    expect(pathAndMiddleware(endpoint)).toEqual(["/", requireUser]);
  });

  it("adds requireAdmin for admin endpoints", () => {
    const endpoint = new Endpoint(root, { ...baseConfig, access: "admin", method: "GET", path: "/" });

    expect(pathAndMiddleware(endpoint)).toEqual(["/", requireAdmin]);
  });
});

describe("respond", () => {
  const root = new Route("/things", "public");
  const withBody = new Endpoint(root, { ...baseConfig, method: "GET", path: "/", responseSchema: Result });
  const withoutBody = new Endpoint(root, { ...baseConfig, method: "DELETE", path: "/", successStatus: "204" });

  it("sends a valid body with the success status", () => {
    const res = mockResponse();

    respond(res as unknown as Response, withBody, { name: "Sword" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ name: "Sword" });
  });

  it("sends only the status for endpoints without a response schema", () => {
    const res = mockResponse();

    respond(res as unknown as Response, withoutBody);

    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });

  it("converts response validation failures to a 500", () => {
    const res = mockResponse();

    let thrown: unknown;
    try {
      respond(res as unknown as Response, withBody, { name: 5 } as never);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(StatusCodeError);
    expect(thrown).toMatchObject({ statusCode: 500, details: { endpoint: "op" } });
    expect((thrown as StatusCodeError).cause).toBeInstanceOf(ZodError);
    expect(res.json).not.toHaveBeenCalled();
  });

  it("rethrows other errors unchanged", () => {
    const res = mockResponse();
    const err = new Error("socket closed");
    res.status.mockImplementation(() => {
      throw err;
    });

    expect(() => respond(res as unknown as Response, withBody, { name: "Sword" })).toThrow(err);
  });
});
