import { number, strictObject, string, uuid } from "zod";

import { ApiRequestError, call, Endpoint, ErrorCode, Route } from "../../../src/api";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const baseConfig = {
  description: "desc",
  id: "op",
  successDescription: "ok",
  summary: "sum"
};

const Thing = strictObject({ id: uuid(), name: string(), price: number() });

const things = new Route("/api/things", "public");
const getThing = new Endpoint(things, {
  ...baseConfig,
  method: "GET",
  path: "/{id}",
  paramsSchema: strictObject({ id: uuid() }),
  responseSchema: Thing
});
const createThing = new Endpoint(things, {
  ...baseConfig,
  method: "POST",
  path: "/",
  bodySchema: Thing.omit({ id: true }),
  responseSchema: Thing,
  successStatus: "201"
});
const deleteThing = new Endpoint(things, {
  ...baseConfig,
  method: "DELETE",
  path: "/{id}",
  paramsSchema: strictObject({ id: uuid() }),
  successStatus: "204"
});
const pingThings = new Endpoint(things, { ...baseConfig, method: "POST", path: "/ping", successStatus: "204" });

const thing = { id: ID, name: "Sword", price: 10 };

const jsonResponse = (status: number, body?: unknown, statusText = "") =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    statusText,
    headers: { "Content-Type": "application/json" }
  });

const mockFetch = (response: Response) => vi.fn<typeof fetch>().mockResolvedValue(response);

describe("call", () => {
  it("sends the built request and returns the parsed body", async () => {
    const fetch = mockFetch(jsonResponse(201, thing));

    const result = await call(createThing, { body: { name: "Sword", price: 10 } }, { fetch });

    expect(result).toEqual(thing);
    expect(fetch).toHaveBeenCalledWith("/api/things", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sword", price: 10 }),
      signal: undefined
    });
  });

  it("prefixes the base url and passes the abort signal", async () => {
    const fetch = mockFetch(jsonResponse(200, thing));
    const { signal } = new AbortController();

    await call(getThing, { params: { id: ID } }, { baseUrl: "http://localhost:4000", fetch, signal });

    expect(fetch).toHaveBeenCalledWith(`http://localhost:4000/api/things/${ID}`, expect.objectContaining({ signal }));
  });

  it("returns undefined for endpoints without a response schema", async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }));

    await expect(call(deleteThing, { params: { id: ID } }, { fetch })).resolves.toBeUndefined();
  });

  it("allows calling endpoints that take no input", async () => {
    const fetch = mockFetch(new Response(null, { status: 204 }));

    await expect(call(pingThings, undefined, { fetch })).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith("/api/things/ping", expect.objectContaining({ method: "POST" }));
  });

  it("skips response validation by default", async () => {
    const fetch = mockFetch(jsonResponse(200, { unexpected: true }));

    await expect(call(getThing, { params: { id: ID } }, { fetch })).resolves.toEqual({ unexpected: true });
  });

  it("validates the response when asked", async () => {
    const fetch = mockFetch(jsonResponse(200, { unexpected: true }));

    await expect(call(getThing, { params: { id: ID } }, { fetch, validateResponse: true })).rejects.toThrow();
  });

  it("rejects invalid input before sending anything", async () => {
    const fetch = mockFetch(jsonResponse(200, thing));

    await expect(call(getThing, { params: { id: "nope" } }, { fetch })).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("throws an ApiRequestError with the error response's message, code, and details", async () => {
    const fetch = mockFetch(jsonResponse(400, { message: "The code is incorrect.", code: ErrorCode.InvalidCode, details: { a: 1 } }));

    const error = await call(getThing, { params: { id: ID } }, { fetch }).catch(err => err);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 400, message: "The code is incorrect.", code: ErrorCode.InvalidCode, details: { a: 1 } });
  });

  it.each([
    ["a non-JSON body", new Response("<html>Bad gateway</html>", { status: 502, statusText: "Bad Gateway" }), "Bad Gateway"],
    ["an empty body", new Response(null, { status: 503, statusText: "Service Unavailable" }), "Service Unavailable"],
    ["an unrecognized JSON body", jsonResponse(500, { error: "nope" }, "Internal Server Error"), "Internal Server Error"],
    ["no status text", new Response(null, { status: 504 }), "Request failed with status 504."]
  ])("falls back to the status text for %s", async (_, response, message) => {
    const error = await call(getThing, { params: { id: ID } }, { fetch: mockFetch(response) }).catch(err => err);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: response.status, message, code: undefined });
  });
});
