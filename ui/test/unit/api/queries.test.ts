import { ApiRequestError, NetworkError } from "@mm/lib/api";
import { auth, getCurrentUser } from "@mm/lib/auth";
import { getProduct, listProducts, products } from "@mm/lib/products";
import { InfiniteQueryObserver, QueryClient } from "@tanstack/react-query";

import {
  endpointInfiniteQuery,
  endpointKey,
  endpointQuery,
  infiniteEndpointKey,
  queryClient,
  routeKey,
  sessionKey,
  sessionQuery,
  shouldRetry
} from "@/api";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";
const OTHER_ID = "9b1d6c2e-4f3a-4b8e-a7c5-1d2e3f4a5b6c";

const product = {
  id: ID,
  title: "Mask of Truth",
  description: "Allows you to see into the minds of others.",
  category: "Masks",
  price: 80,
  inStock: 2
};

const user = { id: "user-123", email: "link@hyrule.com", name: "Link", isAdmin: false };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const stubFetch = (handler: (url: URL, init?: RequestInit) => Response | Promise<Response>) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => handler(new URL(String(input), "http://localhost"), init));
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const testClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

afterEach(() => {
  vi.unstubAllGlobals();
  queryClient.clear();
});

describe("keys", () => {
  it("builds route keys from the route's full path", () => {
    expect(routeKey(products)).toEqual(["api", "products"]);
    expect(routeKey(auth)).toEqual(["api", "auth"]);
  });

  it("nests endpoint keys under their route with the input last", () => {
    expect(endpointKey(getProduct, { params: { id: ID } })).toEqual(["api", "products", "getProduct", { params: { id: ID } }]);
    expect(endpointKey(listProducts, {})).toEqual(["api", "products", "listProducts", {}]);
  });

  it("keeps infinite queries apart from regular ones for the same endpoint", () => {
    expect(infiniteEndpointKey(listProducts, {})).toEqual(["api", "products", "listProducts", "infinite", {}]);
  });

  it("keys the session by the current user endpoint", () => {
    expect(sessionKey).toEqual(endpointKey(getCurrentUser, {}));
  });
});

describe("shouldRetry", () => {
  it.each([
    ["a 500", new ApiRequestError(500, "boom"), true],
    ["a 503", new ApiRequestError(503, "busy"), true],
    ["a 429", new ApiRequestError(429, "slow down"), true],
    ["a 400", new ApiRequestError(400, "bad"), false],
    ["a 401", new ApiRequestError(401, "Unauthorized"), false],
    ["a 404", new ApiRequestError(404, "missing"), false],
    ["a network failure", new NetworkError(new TypeError("Failed to fetch")), true],
    ["a bug in a query function", new TypeError("Cannot read properties of undefined"), false],
    ["an input validation error", new Error("invalid input"), false]
  ])("decides on %s", (_, error, expected) => {
    expect(shouldRetry(0, error)).toBe(expected);
  });

  it("stops after two retries", () => {
    expect(shouldRetry(2, new ApiRequestError(500, "boom"))).toBe(false);
  });
});

describe("endpointQuery", () => {
  it("fetches through the contract and caches under the endpoint key", async () => {
    const fetch = stubFetch(() => json(200, product));
    const client = testClient();
    const options = endpointQuery(getProduct, { params: { id: ID } });

    await expect(client.query(options)).resolves.toEqual(product);

    expect(fetch.mock.calls[0][0]).toBe(`/api/products/${ID}`);
    expect(client.getQueryData(options.queryKey)).toEqual(product);
  });

  it("validates responses in development", async () => {
    stubFetch(() => json(200, { ...product, price: "free" }));

    await expect(testClient().query(endpointQuery(getProduct, { params: { id: ID } }))).rejects.toThrow();
  });

  it("is invalidated by its route's key", async () => {
    stubFetch(() => json(200, product));
    const client = testClient();
    const options = endpointQuery(getProduct, { params: { id: ID } });
    await client.query(options);

    await client.invalidateQueries({ queryKey: routeKey(products), refetchType: "none" });

    expect(client.getQueryState(options.queryKey)?.isInvalidated).toBe(true);
  });
});

describe("endpointInfiniteQuery", () => {
  const page = (id: string, pagination: { hasNext: boolean; cursor?: string }) => ({
    data: [{ id, title: product.title, price: product.price }],
    pagination: { limit: 20, ...pagination }
  });

  it("pages with the cursor from the previous response", async () => {
    const fetch = stubFetch(url =>
      url.searchParams.get("cursor") === "next-page" ? json(200, page(OTHER_ID, { hasNext: false })) : json(200, page(ID, { hasNext: true, cursor: "next-page" }))
    );
    const observer = new InfiniteQueryObserver(testClient(), endpointInfiniteQuery(listProducts, { query: { category: "Masks" } }));

    await observer.refetch();
    const result = await observer.fetchNextPage();

    expect(result.data?.pages.map(p => p.data[0].id)).toEqual([ID, OTHER_ID]);
    expect(result.hasNextPage).toBe(false);
    const urls = fetch.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
    expect(urls.map(url => url.searchParams.get("cursor"))).toEqual([null, "next-page"]);
    expect(urls.every(url => url.searchParams.get("category") === "Masks")).toBe(true);
  });
});

describe("sessionQuery", () => {
  it("returns the current user", async () => {
    stubFetch(() => json(200, user));

    await expect(queryClient.query(sessionQuery)).resolves.toEqual(user);
  });

  it("resolves to null when signed out and the refresh fails", async () => {
    const fetch = stubFetch(() => json(401, { message: "Unauthorized" }));

    await expect(queryClient.query(sessionQuery)).resolves.toBeNull();
    expect(fetch.mock.calls.map(([input]) => String(input))).toEqual(["/api/auth/me", "/api/auth/refresh"]);
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
  });

  it("recovers the session when the refresh succeeds", async () => {
    let refreshed = false;
    stubFetch(url => {
      if (url.pathname === "/api/auth/refresh") {
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed ? json(200, user) : json(401, { message: "Unauthorized" });
    });

    await expect(queryClient.query(sessionQuery)).resolves.toEqual(user);
  });

  it("surfaces errors other than 401", async () => {
    stubFetch(() => json(500, { message: "boom" }));

    await expect(queryClient.query(sessionQuery)).rejects.toMatchObject({ status: 500 });
  });
});
