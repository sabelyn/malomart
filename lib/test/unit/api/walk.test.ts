import { collectEndpoints, Endpoint, Route } from "../../../src/api";

const baseConfig = {
  description: "desc",
  schemas: {},
  successDescription: "ok",
  summary: "sum"
};

describe("collectEndpoints", () => {
  it("returns nothing for a route without endpoints", () => {
    expect(collectEndpoints(new Route("/empty"))).toEqual([]);
  });

  it("collects endpoints from nested routes in declaration order", () => {
    const root = new Route("/api", "public");
    const things = new Route("/things", "public", [], root);
    const list = new Endpoint(things, { ...baseConfig, id: "list", method: "GET", path: "/" });
    const widgets = new Route("/widgets", "public", [], things);
    const getWidget = new Endpoint(widgets, { ...baseConfig, id: "getWidget", method: "GET", path: "/{id}" });
    const create = new Endpoint(things, { ...baseConfig, id: "create", method: "POST", path: "/" });

    expect(collectEndpoints(root)).toEqual([list, getWidget, create]);
  });

  it("includes the route itself when it is an endpoint", () => {
    const endpoint = new Endpoint(new Route("/x"), { ...baseConfig, id: "x", method: "GET", path: "/" });

    expect(collectEndpoints(endpoint)).toEqual([endpoint]);
  });
});
