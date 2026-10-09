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
