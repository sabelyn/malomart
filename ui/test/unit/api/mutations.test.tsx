import { ApiRequestError } from "@mm/lib/api";
import { auth, signOut } from "@mm/lib/auth";
import { createProduct, getProduct, products } from "@mm/lib/products";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { endpointKey, useEndpointMutation } from "@/api";
import { json, requestsTo, stubApi } from "../../utils";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const productData = {
  title: "Mask of Truth",
  description: "Allows you to see into the minds of others.",
  category: "Masks" as const,
  price: 80,
  inStock: 2,
  features: ["Reveals hidden truths"]
};

const product = { id: ID, ...productData };

const productKey = endpointKey(getProduct, { params: { id: ID } });
const otherKey = endpointKey(signOut, {});

const setup = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(productKey, product);
  queryClient.setQueryData(otherKey, "untouched");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useEndpointMutation", () => {
  it("calls the endpoint with the variables and returns the response", async () => {
    const fetch = stubApi({ "POST /api/products": () => json(201, product) });
    const { wrapper } = setup();
    const { result } = renderHook(() => useEndpointMutation(createProduct), { wrapper });

    result.current.mutate({ body: productData });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(product);
    expect(requestsTo(fetch, "POST /api/products")).toEqual([productData]);
  });

  it("invalidates queries under the listed routes before calling onSuccess", async () => {
    stubApi({ "POST /api/products": () => json(201, product) });
    const { queryClient, wrapper } = setup();
    const invalidatedWhenCalled: boolean[] = [];
    const onSuccess = vi.fn(() => {
      invalidatedWhenCalled.push(queryClient.getQueryState(productKey)?.isInvalidated ?? false);
    });
    const { result } = renderHook(() => useEndpointMutation(createProduct, { invalidates: [products], onSuccess }), {
      wrapper
    });

    result.current.mutate({ body: productData });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(invalidatedWhenCalled).toEqual([true]);
    expect(queryClient.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });

  it("leaves the cache alone when no routes are listed", async () => {
    stubApi({ "POST /api/products": () => json(201, product) });
    const { queryClient, wrapper } = setup();
    const { result } = renderHook(() => useEndpointMutation(createProduct), { wrapper });

    result.current.mutate({ body: productData });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(productKey)?.isInvalidated).toBe(false);
  });

  it("surfaces API errors without invalidating or calling onSuccess", async () => {
    stubApi({ "POST /api/products": () => json(403, { message: "Forbidden" }) });
    const { queryClient, wrapper } = setup();
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () => useEndpointMutation(createProduct, { invalidates: [products, auth], onSuccess }),
      {
        wrapper
      }
    );

    result.current.mutate({ body: productData });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiRequestError);
    expect(result.current.error).toMatchObject({ status: 403 });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(productKey)?.isInvalidated).toBe(false);
  });
});
