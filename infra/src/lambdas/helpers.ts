import type { InvokeErrorResponse } from "@mm/lib/lambdas";

const RETRIABLE_ERRORS = new Set([
  "ThrottlingException",
  "ProvisionedThroughputExceededException",
  "RequestLimitExceeded",
  "KeyUnavailableException",
  "DependencyTimeoutException",
  "KMSInternalException",
  "InternalServerError"
]);

export const isRetriableError = (err: unknown) => err instanceof Error && RETRIABLE_ERRORS.has(err.name);

export const hasErrorName = (err: unknown, name: string) => err instanceof Error && err.name === name;

export const toInvokeError = (err: unknown): InvokeErrorResponse => {
  if (isRetriableError(err)) {
    throw err;
  }

  console.error(err);
  return { errorName: err instanceof Error ? err.name : "Unknown" };
};
