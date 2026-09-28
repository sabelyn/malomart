import type { Request, Response } from "express";
import { coerce, number, object, strictObject, string, uuid } from "zod";

import { Endpoint, Route } from "../../../src/api";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const Params = strictObject({ id: uuid() });
const Query = object({ limit: coerce.number().optional(), name: string().optional() });
const Body = strictObject({ name: string(), price: number() });
const Result = strictObject({ id: uuid(), name: string() });

const baseConfig = {
  description: "desc",
  id: "op",
  successDescription: "ok",
  summary: "sum"
};

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

describe("Endpoint", () => {
  describe("constructor", () => {
    it("applies defaults for optional config", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/" });

      expect(endpoint.successStatus).toBe("200");
      expect(endpoint.errors).toEqual({});
      expect(endpoint.bodySchema).toBeUndefined();
      expect(endpoint.paramsSchema).toBeUndefined();
      expect(endpoint.querySchema).toBeUndefined();
      expect(endpoint.responseSchema).toBeUndefined();
    });

    it("inherits access from its parent", () => {
      const parent = new Route("/things", "admin");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/" });

      expect(endpoint.access).toBe("admin");
    });

    it("overrides parent access when configured", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, access: "admin", method: "GET", path: "/" });

      expect(endpoint.access).toBe("admin");
    });

    it("combines its own tags with the parent's", () => {
      const parent = new Route("/things", "public", ["Products"]);
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", tags: ["Products"] });

      expect([...endpoint.tags]).toEqual(["Products"]);
    });

    it("registers itself with the parent once", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/" });

      expect([...parent.children]).toEqual([endpoint]);
    });

    it("computes full and express paths", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/{id}", paramsSchema: Params });

      expect(endpoint.fullPath).toBe("/things/{id}");
      expect(endpoint.expressPath).toBe("/:id");
    });
  });

  describe("request", () => {
    const parent = new Route("/things", "public");
    const getThing = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/{id}", paramsSchema: Params });
    const listThings = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", querySchema: Query });
    const createThing = new Endpoint(parent, { ...baseConfig, access: "admin", method: "POST", path: "/", bodySchema: Body });

    it("substitutes path params", () => {
      const req = getThing.request(undefined, { id: ID });

      expect(req.path).toBe(`/things/${ID}`);
      expect(req.method).toBe("GET");
      expect(req.body).toBeUndefined();
    });

    it("builds an encoded query string", () => {
      const req = listThings.request(undefined, undefined, { limit: 25, name: "sword & shield" });

      expect(req.path).toBe("/things?limit=25&name=sword%20%26%20shield");
    });

    it("skips undefined query values and omits an empty query string", () => {
      const req = listThings.request(undefined, undefined, { name: undefined });

      expect(req.path).toBe("/things");
    });

    it("validates and returns the body", () => {
      const req = createThing.request({ name: "Sword", price: 10 }, undefined, undefined, "tok");

      expect(req.body).toEqual({ name: "Sword", price: 10 });
      expect(req.method).toBe("POST");
    });

    it("throws on invalid params", () => {
      expect(() => getThing.request(undefined, { id: "nope" })).toThrow();
    });

    it("throws on an invalid body", () => {
      expect(() => createThing.request({ name: "Sword" } as never, undefined, undefined, "tok")).toThrow();
    });

    it("omits auth for public endpoints without a token", () => {
      const req = getThing.request(undefined, { id: ID });

      expect(req.headers).toEqual({ "Content-Type": "application/json" });
    });

    it("adds a bearer token when given", () => {
      const req = createThing.request({ name: "Sword", price: 10 }, undefined, undefined, "tok");

      expect(req.headers.Authorization).toBe("Bearer tok");
    });

    it("requires a token for non-public endpoints", () => {
      expect(() => createThing.request({ name: "Sword", price: 10 })).toThrow("/things requires a bearer token");
    });
  });

  describe("response", () => {
    const parent = new Route("/things", "public");

    it("parses the body and sends it with the success status", () => {
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "POST", path: "/", responseSchema: Result, successStatus: "201" });
      const res = mockResponse();

      endpoint.response(res as unknown as Response, { id: ID, name: "Sword" });

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ id: ID, name: "Sword" });
    });

    it("throws without sending when the body fails the response schema", () => {
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", responseSchema: Result });
      const res = mockResponse();

      expect(() => endpoint.response(res as unknown as Response, { id: ID } as never)).toThrow();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("sends only the status when there is no response schema", () => {
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "DELETE", path: "/", successStatus: "204" });
      const res = mockResponse();

      endpoint.response(res as unknown as Response);

      expect(res.sendStatus).toHaveBeenCalledWith(204);
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("validateRequest", () => {
    const parent = new Route("/things", "public");
    const endpoint = new Endpoint(parent, {
      ...baseConfig,
      method: "PUT",
      path: "/{id}",
      bodySchema: Body,
      paramsSchema: Params,
      querySchema: Query
    });

    it("parses body, params, and query", () => {
      const req = { body: { name: "Sword", price: 10 }, params: { id: ID }, query: { limit: "5" } } as unknown as Request;

      expect(endpoint.validateRequest(req)).toEqual({
        body: { name: "Sword", price: 10 },
        params: { id: ID },
        query: { limit: 5 }
      });
    });

    it("returns undefined for parts without schemas", () => {
      const bare = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/" });
      const req = { body: { a: 1 }, params: { b: 2 }, query: { c: 3 } } as unknown as Request;

      expect(bare.validateRequest(req)).toEqual({ body: undefined, params: undefined, query: undefined });
    });

    it("throws when any part is invalid", () => {
      const req = { body: { name: "Sword", price: 10 }, params: { id: "nope" }, query: {} } as unknown as Request;

      expect(() => endpoint.validateRequest(req)).toThrow();
    });
  });
});
