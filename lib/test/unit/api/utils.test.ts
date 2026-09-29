import { string, strictObject, uuid } from "zod";

import {
  commonAdminErrors,
  commonErrors,
  commonProtectedErrors,
  Endpoint,
  error,
  ErrorResponse,
  requestBody,
  requestParams,
  response,
  Route,
  routeToPaths
} from "../../../src/api";

const Params = strictObject({ id: uuid() });
const Query = strictObject({ name: string().optional() });
const Body = strictObject({ name: string() });

const baseConfig = {
  description: "desc",
  schemas: {},
  successDescription: "ok",
  summary: "sum"
};

describe("requestBody", () => {
  it("wraps the schema as required json content", () => {
    expect(requestBody(Body)).toEqual({ required: true, content: { "application/json": { schema: Body } } });
  });
});

describe("requestParams", () => {
  it("includes only the schemas provided", () => {
    expect(requestParams()).toEqual({});
    expect(requestParams(Params)).toEqual({ path: Params });
    expect(requestParams(undefined, Query)).toEqual({ query: Query });
    expect(requestParams(Params, Query)).toEqual({ path: Params, query: Query });
  });
});

describe("response", () => {
  it("includes only the parts provided", () => {
    expect(response()).toEqual({});
    expect(response("ok")).toEqual({ description: "ok" });
    expect(response("ok", Body)).toEqual({ description: "ok", content: { "application/json": { schema: Body } } });
  });
});

describe("error", () => {
  it("uses the error response schema", () => {
    expect(error("bad")).toEqual({ description: "bad", content: { "application/json": { schema: ErrorResponse } } });
  });
});

describe("common errors", () => {
  it("layers protected and admin errors on top of the base set", () => {
    expect(Object.keys(commonErrors).sort()).toEqual(["429", "500", "503"]);
    expect(Object.keys(commonProtectedErrors).sort()).toEqual(["401", "429", "500", "503"]);
    expect(Object.keys(commonAdminErrors).sort()).toEqual(["401", "403", "429", "500", "503"]);
  });
});

describe("routeToPaths", () => {
  it("returns nothing for a route without endpoints", () => {
    expect(routeToPaths(new Route("/empty"))).toEqual({});
  });

  it("groups endpoints by full path and method", () => {
    const root = new Route("/things", "public");
    new Endpoint(root, { ...baseConfig, id: "list", method: "GET", path: "/" });
    new Endpoint(root, { ...baseConfig, id: "create", access: "admin", method: "POST", path: "/", schemas: { body: Body } });
    new Endpoint(root, { ...baseConfig, id: "get", method: "GET", path: "/{id}", schemas: { params: Params } });

    const paths = routeToPaths(root);

    expect(Object.keys(paths)).toEqual(["/things", "/things/{id}"]);
    expect(Object.keys(paths["/things"]!)).toEqual(["get", "post"]);
    expect(paths["/things"]!.get!.operationId).toBe("list");
    expect(paths["/things"]!.post!.operationId).toBe("create");
    expect(paths["/things/{id}"]!.get!.operationId).toBe("get");
  });

  it("includes endpoints from nested routes", () => {
    const root = new Route("/things", "public");
    const nested = new Route("/{id}/reviews", "public", [], root);
    new Endpoint(nested, { ...baseConfig, id: "listReviews", method: "GET", path: "/", schemas: { params: Params } });

    const paths = routeToPaths(root);

    expect(paths["/things/{id}/reviews"]!.get!.operationId).toBe("listReviews");
  });

  it("builds an operation with metadata, params, and body", () => {
    const root = new Route("/things", "public", ["Products"]);
    new Endpoint(root, {
      ...baseConfig,
      id: "update",
      access: "admin",
      method: "PUT",
      path: "/{id}",
      schemas: { body: Body, params: Params, query: Query }
    });

    const op = routeToPaths(root)["/things/{id}"]!.put!;

    expect(op).toMatchObject({ operationId: "update", summary: "sum", description: "desc", tags: ["Products"] });
    expect(op.requestParams).toEqual({ path: Params, query: Query });
    expect(op.requestBody).toEqual(requestBody(Body));
  });

  it("omits params and body when the endpoint has no schemas", () => {
    const root = new Route("/things", "public");
    new Endpoint(root, { ...baseConfig, id: "list", method: "GET", path: "/" });

    const op = routeToPaths(root)["/things"]!.get!;

    expect(op.requestParams).toBeUndefined();
    expect(op.requestBody).toBeUndefined();
  });

  it("includes the success response with its schema and status", () => {
    const root = new Route("/things", "public");
    new Endpoint(root, { ...baseConfig, id: "create", method: "POST", path: "/", schemas: { response: Body }, successStatus: "201" });

    const op = routeToPaths(root)["/things"]!.post!;

    expect(op.responses["201"]).toEqual(response("ok", Body));
  });

  it.each([
    ["public", commonErrors],
    ["user", commonProtectedErrors],
    ["admin", commonAdminErrors]
  ] as const)("adds common errors for %s access alongside success and endpoint errors", (access, common) => {
    const root = new Route("/things", access);
    new Endpoint(root, { ...baseConfig, id: "op", method: "GET", path: "/", errors: { 404: "missing" } });

    const op = routeToPaths(root)["/things"]!.get!;

    expect(Object.keys(op.responses).sort()).toEqual(["200", "404", ...Object.keys(common)].sort());
    expect(op.responses["200"]).toEqual(response("ok"));
    expect(op.responses["404"]).toEqual(error("missing"));
  });

  it("lets endpoint errors override common errors", () => {
    const root = new Route("/things", "user");
    new Endpoint(root, { ...baseConfig, id: "op", method: "GET", path: "/", errors: { 401: "custom" } });

    const op = routeToPaths(root)["/things"]!.get!;

    expect(op.responses["401"]).toEqual(error("custom"));
  });
});
