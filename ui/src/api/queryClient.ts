import { ApiRequestError, NetworkError } from "@mm/lib/api";
import { QueryClient } from "@tanstack/react-query";

import { createApiCaller } from "./client";
import { sessionKey } from "./keys";

const MAX_RETRIES = 2;

export const shouldRetry = (failureCount: number, error: unknown) => {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }
  if (error instanceof ApiRequestError) {
    return error.status >= 500 || error.status === 429;
  }
  return error instanceof NetworkError;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry
    }
  }
});

export const apiCall = createApiCaller({
  validateResponse: import.meta.env.DEV,
  onSessionExpired: () => queryClient.setQueryData(sessionKey, null)
});
