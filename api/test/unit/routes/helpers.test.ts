import { Endpoint, Route } from "@mm/lib/api";
import type { Request, Response } from "express";
import { coerce, number, object, strictObject, string, uuid, ZodError } from "zod";

import { ApiError } from "@/errors/ApiError";
import { requireAdmin, requireUser } from "@/middleware";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "@/routes/helpers";

const baseConfig = {
  description: "desc",
  id: "op",
  schemas: {},
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
  const withBody = new Endpoint(root, { ...baseConfig, method: "GET", path: "/", schemas: { response: Result } });
  it("sends a valid body with the success status", () => {
    const res = mockResponse();

    respond(res as unknown as Response, withBody, { name: "Sword" });

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ name: "Sword" });
  });

  it("converts response validation failures to a 500", () => {
    const res = mockResponse();

    let thrown: unknown;
    try {
      respond(res as unknown as Response, withBody, { name: 5 } as never);
    } catch (err) {
      thrown = err;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect(thrown).toMatchObject({ statusCode: 500, details: { endpoint: "op" } });
    expect((thrown as ApiError).cause).toBeInstanceOf(ZodError);
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

describe("respondEmpty", () => {
  it("sends only the success status", () => {
    const root = new Route("/things", "public");
    const endpoint = new Endpoint(root, { ...baseConfig, method: "DELETE", path: "/", successStatus: "204" });
    const res = mockResponse();

    respondEmpty(res as unknown as Response, endpoint);

    expect(res.sendStatus).toHaveBeenCalledWith(204);
  });
});

describe("validateRequest", () => {
  const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";
  const root = new Route("/things", "public");
  const endpoint = new Endpoint(root, {
    ...baseConfig,
    method: "PUT",
    path: "/{id}",
    schemas: {
      body: strictObject({ name: string(), price: number() }),
      params: strictObject({ id: uuid() }),
      query: object({ limit: coerce.number().optional() })
    }
  });

  it("parses body, params, and query", () => {
    const req = { body: { name: "Sword", price: 10 }, params: { id: ID }, query: { limit: "5" } } as unknown as Request;

    expect(validateRequest(endpoint, req)).toEqual({
      body: { name: "Sword", price: 10 },
      params: { id: ID },
      query: { limit: 5 }
    });
  });

  it("returns undefined for parts without schemas", () => {
    const bare = new Endpoint(root, { ...baseConfig, method: "GET", path: "/" });
    const req = { body: { a: 1 }, params: { b: 2 }, query: { c: 3 } } as unknown as Request;

    expect(validateRequest(bare, req)).toEqual({ body: undefined, params: undefined, query: undefined });
  });

  it("throws when any part is invalid", () => {
    const req = { body: { name: "Sword", price: 10 }, params: { id: "nope" }, query: {} } as unknown as Request;

    expect(() => validateRequest(endpoint, req)).toThrow(ZodError);
  });
});
