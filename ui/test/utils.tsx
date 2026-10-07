import { MantineProvider } from "@mantine/core";
import type { CurrentUser } from "@mm/lib/auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";

import { sessionKey } from "@/api";

export const customer: CurrentUser = { id: "user-123", email: "link@hyrule.com", name: "Link", isAdmin: false };
export const admin: CurrentUser = { id: "admin-123", email: "malo@malomart.com", name: "Malo", isAdmin: true };

type RenderOptions = {
  route?: string;
  session?: CurrentUser | null;
};

export const LocationDisplay = () => {
  const { pathname, search } = useLocation();
  return <p data-testid="location">{`${pathname}${search}`}</p>;
};

export const renderWithProviders = (ui: ReactNode, { route = "/", session }: RenderOptions = {}) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (session !== undefined) {
    queryClient.setQueryData(sessionKey, session);
  }

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </MantineProvider>
    </QueryClientProvider>
  );
  return { ...result, queryClient };
};

export const neverResolvingFetch = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => undefined))
  );

export const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });

type ApiHandler = (body: unknown) => Response | Promise<Response>;

export const stubApi = (handlers: Record<string, ApiHandler>) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async (input, init) => {
    const route = `${init?.method ?? "GET"} ${String(input)}`;
    const handler = handlers[route];
    if (!handler) {
      throw new Error(`Unexpected request: ${route}`);
    }
    return handler(typeof init?.body === "string" ? JSON.parse(init.body) : undefined);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

export const requestsTo = (fetch: ReturnType<typeof stubApi>, route: string) =>
  fetch.mock.calls
    .filter(([input, init]) => `${init?.method ?? "GET"} ${String(input)}` === route)
    .map(([, init]) => (typeof init?.body === "string" ? JSON.parse(init.body) : undefined));
