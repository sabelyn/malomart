import { coerce, number, object, strictObject, string, uuid } from "zod";

import { Endpoint, Route } from "../../../src/api";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const Params = strictObject({ id: uuid() });
const Query = object({ limit: coerce.number().optional(), name: string().optional() });
const Body = strictObject({ name: string(), price: number() });

const baseConfig = {
  description: "desc",
  id: "op",
  successDescription: "ok",
  summary: "sum"
};

describe("Endpoint", () => {
  describe("constructor", () => {
    it("applies defaults for optional config", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", schemas: {} });

      expect(endpoint.successStatus).toBe("200");
      expect(endpoint.errors).toEqual({});
      expect(endpoint.schemas).toEqual({});
    });

    it("inherits access from its parent", () => {
      const parent = new Route("/things", "admin");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", schemas: {} });

      expect(endpoint.access).toBe("admin");
    });

    it("overrides parent access when configured", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, access: "admin", method: "GET", path: "/", schemas: {} });

      expect(endpoint.access).toBe("admin");
    });

    it("combines its own tags with the parent's", () => {
      const parent = new Route("/things", "public", ["Products"]);
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", schemas: {}, tags: ["Products"] });

      expect([...endpoint.tags]).toEqual(["Products"]);
    });

    it("registers itself with the parent once", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", schemas: {} });

      expect([...parent.children]).toEqual([endpoint]);
    });

    it("computes full and express paths", () => {
      const parent = new Route("/things", "public");
      const endpoint = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/{id}", schemas: { params: Params } });

      expect(endpoint.fullPath).toBe("/things/{id}");
      expect(endpoint.expressPath).toBe("/:id");
    });
  });

  describe("request", () => {
    const parent = new Route("/things", "public");
    const getThing = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/{id}", schemas: { params: Params } });
    const listThings = new Endpoint(parent, { ...baseConfig, method: "GET", path: "/", schemas: { query: Query } });
    const createThing = new Endpoint(parent, { ...baseConfig, access: "admin", method: "POST", path: "/", schemas: { body: Body } });
    const pingThings = new Endpoint(parent, { ...baseConfig, access: "user", method: "POST", path: "/ping", schemas: {} });

    it("substitutes path params", () => {
      const { url, init } = getThing.request({ params: { id: ID } });

      expect(url).toBe(`/things/${ID}`);
      expect(init).toEqual({ method: "GET", headers: { Accept: "application/json" } });
    });

    it("encodes path params", () => {
      const parentWithSlug = new Route("/slugs", "public");
      const getSlug = new Endpoint(parentWithSlug, {
        ...baseConfig,
        method: "GET",
        path: "/{slug}",
        schemas: { params: strictObject({ slug: string() }) }
      });

      expect(getSlug.request({ params: { slug: "a/b c" } }).url).toBe("/slugs/a%2Fb%20c");
    });

    it("builds an encoded query string", () => {
      const { url } = listThings.request({ query: { limit: 25, name: "sword & shield" } });

      expect(url).toBe("/things?limit=25&name=sword+%26+shield");
    });

    it("skips undefined query values and omits an empty query string", () => {
      expect(listThings.request({ query: { name: undefined } }).url).toBe("/things");
      expect(listThings.request({ query: {} }).url).toBe("/things");
    });

    it("takes an empty input for endpoints without request schemas", () => {
      expect(pingThings.request({}).url).toBe("/things/ping");
    });

    it("serializes a validated body as JSON", () => {
      const { init } = createThing.request({ body: { name: "Sword", price: 10 } });

      expect(init).toEqual({
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Sword", price: 10 })
      });
    });

    it("never adds an authorization header, even for protected endpoints", () => {
      expect(pingThings.request({}).init.headers).toEqual({ Accept: "application/json" });
    });

    it("throws on invalid params", () => {
      expect(() => getThing.request({ params: { id: "nope" } })).toThrow();
    });

    it("throws on an invalid body", () => {
      expect(() => createThing.request({ body: { name: "Sword" } as never })).toThrow();
    });
  });
});
