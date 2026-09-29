import * as lib from "../../src";
import { apiRoot, collectEndpoints, Endpoint } from "../../src/api";

const endpoints = collectEndpoints(apiRoot);

const exportedEndpoints = Object.values(lib).filter(value => value instanceof Endpoint);

const placeholders = (path: string) => [...path.matchAll(/\{([^}]+)\}/g)].map(([, name]) => name);

const duplicates = (values: string[]) => [...new Set(values.filter((value, i) => values.indexOf(value) !== i))];

describe("lib routes", () => {
  it("finds endpoints to validate", () => {
    expect(endpoints.length).toBeGreaterThan(0);
  });

  it("reaches every exported endpoint from the api root", () => {
    expect(exportedEndpoints.filter(endpoint => !endpoints.includes(endpoint)).map(e => e.id)).toEqual([]);
  });

  it("has unique operation ids", () => {
    expect(duplicates(endpoints.map(e => e.id))).toEqual([]);
  });

  it("has only one endpoint per method and path", () => {
    expect(duplicates(endpoints.map(e => `${e.method} ${e.fullPath.replace(/\{[^}]+\}/g, "{}")}`))).toEqual([]);
  });

  it("puts every endpoint under /api", () => {
    expect(endpoints.filter(e => !e.fullPath.startsWith("/api/")).map(e => e.id)).toEqual([]);
  });

  describe.each(endpoints.map(e => [`${e.method} ${e.fullPath} (${e.id})`, e] as const))("%s", (_, endpoint) => {
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
