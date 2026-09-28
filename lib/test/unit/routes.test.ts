import * as lib from "../../src";
import { Endpoint, Route } from "../../src/api";
import type { Body, Params, Query } from "../../src/api";

type AnyEndpoint = Endpoint<Body, Params, Query, Body>;

const collectEndpoints = (route: Route, found: Set<AnyEndpoint>) => {
  if (route instanceof Endpoint) {
    found.add(route);
  }
  route.children.forEach(child => collectEndpoints(child, found));
};

const endpoints = new Set<AnyEndpoint>();
for (const value of Object.values(lib)) {
  if (value instanceof Route) {
    collectEndpoints(value, endpoints);
  }
}

const placeholders = (path: string) => [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => name);

const duplicates = (values: string[]) => [...new Set(values.filter((value, i) => values.indexOf(value) !== i))];

describe("lib routes", () => {
  it("finds endpoints to validate", () => {
    expect(endpoints.size).toBeGreaterThan(0);
  });

  it("has unique operation ids", () => {
    expect(duplicates([...endpoints].map(e => e.id))).toEqual([]);
  });

  it("has only one endpoint per method and path", () => {
    expect(duplicates([...endpoints].map(e => `${e.method} ${e.fullPath.replace(/\{[^}]+\}/g, "{}")}`))).toEqual([]);
  });

  describe.each([...endpoints].map(e => [`${e.method} ${e.fullPath} (${e.id})`, e] as const))("%s", (_, endpoint) => {
    const pathKeys = placeholders(endpoint.fullPath);
    const schemaKeys = Object.keys(endpoint.paramsSchema?.shape ?? {});

    it("has a placeholder for every params property", () => {
      expect(schemaKeys.filter(key => !pathKeys.includes(key))).toEqual([]);
    });

    it("has a params property for every placeholder", () => {
      expect(pathKeys.filter(key => !schemaKeys.includes(key))).toEqual([]);
    });
  });
});
