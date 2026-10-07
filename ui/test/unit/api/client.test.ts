import { ApiRequestError } from "@mm/lib/api";
import { getCurrentUser, signIn } from "@mm/lib/auth";
import { getProduct } from "@mm/lib/products";

import { createApiCaller, isUnauthorized } from "@/api/client";

const user = { id: "user-123", email: "link@hyrule.com", name: "Link", isAdmin: false };

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

const unauthorized = () => json(401, { message: "Unauthorized" });

const pathOf = (input: RequestInfo | URL) => String(input);

const isRefresh = (input: RequestInfo | URL) => pathOf(input) === "/api/auth/refresh";

const refreshCalls = (fetch: ReturnType<typeof vi.fn<typeof globalThis.fetch>>) =>
  fetch.mock.calls.filter(([input]) => isRefresh(input)).length;

describe("isUnauthorized", () => {
  it.each([
    ["a 401 ApiRequestError", new ApiRequestError(401, "Unauthorized"), true],
    ["a 403 ApiRequestError", new ApiRequestError(403, "Forbidden"), false],
    ["a plain error", new Error("boom"), false]
  ])("detects %s", (_, err, expected) => {
    expect(isUnauthorized(err)).toBe(expected);
  });
});

describe("createApiCaller", () => {
  it("returns the response without refreshing when the call succeeds", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, user));
    const apiCall = createApiCaller({ fetch });

    await expect(apiCall(getCurrentUser, {})).resolves.toEqual(user);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("passes the base url and abort signal through", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(json(200, user));
    const { signal } = new AbortController();
    const apiCall = createApiCaller({ fetch, baseUrl: "http://localhost:4000" });

    await apiCall(getCurrentUser, {}, { signal });

    expect(fetch).toHaveBeenCalledWith("http://localhost:4000/api/auth/me", expect.objectContaining({ signal }));
  });

  it("refreshes the session and retries once after a 401", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(json(200, user));
    const apiCall = createApiCaller({ fetch });

    await expect(apiCall(getCurrentUser, {})).resolves.toEqual(user);
    expect(fetch.mock.calls.map(([input, init]) => `${init?.method} ${pathOf(input)}`)).toEqual([
      "GET /api/auth/me",
      "POST /api/auth/refresh",
      "GET /api/auth/me"
    ]);
  });

  it("shares one refresh between concurrent 401s", async () => {
    let refreshed = false;
    const fetch = vi.fn<typeof globalThis.fetch>(async input => {
      if (isRefresh(input)) {
        await new Promise(resolve => setTimeout(resolve, 5));
        refreshed = true;
        return new Response(null, { status: 204 });
      }
      return refreshed ? json(200, user) : unauthorized();
    });
    const apiCall = createApiCaller({ fetch });

    await expect(
      Promise.all([apiCall(getCurrentUser, {}), apiCall(getCurrentUser, {}), apiCall(getCurrentUser, {})])
    ).resolves.toEqual([user, user, user]);
    expect(refreshCalls(fetch)).toBe(1);
  });

  it("refreshes again for a later 401 once the previous refresh has finished", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(input =>
      Promise.resolve(isRefresh(input) ? new Response(null, { status: 204 }) : unauthorized())
    );
    const apiCall = createApiCaller({ fetch });

    await expect(apiCall(getCurrentUser, {})).rejects.toThrow(ApiRequestError);
    await expect(apiCall(getCurrentUser, {})).rejects.toThrow(ApiRequestError);
    expect(refreshCalls(fetch)).toBe(2);
  });

  it("reports an expired session and rethrows the 401 when the refresh fails", async () => {
    const onSessionExpired = vi.fn();
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(unauthorized()));
    const apiCall = createApiCaller({ fetch, onSessionExpired });

    const error = await apiCall(getCurrentUser, {}).catch(err => err);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("does not refresh for the sign-in flow endpoints", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(unauthorized()));
    const apiCall = createApiCaller({ fetch });

    await expect(apiCall(signIn, { body: { email: "link@hyrule.com" } })).rejects.toMatchObject({ status: 401 });
    expect(refreshCalls(fetch)).toBe(0);
  });

  it.each([403, 404, 500])("does not refresh after a %i", async status => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => Promise.resolve(json(status, { message: "nope" })));
    const apiCall = createApiCaller({ fetch });

    await expect(apiCall(getProduct, { params: { id: "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c" } })).rejects.toMatchObject(
      { status }
    );
    expect(refreshCalls(fetch)).toBe(0);
  });
});
