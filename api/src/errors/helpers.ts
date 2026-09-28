import { DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { treeifyError, ZodError } from "zod";

import { ApiError } from "./ApiError";

export const badRequest = (message: string, options?: { details?: unknown; cause?: unknown }) =>
  new ApiError(400, message, options);

export const unauthorized = (cause?: unknown) => new ApiError(401, "Unauthorized", { cause });

export const forbidden = () => new ApiError(403, "Forbidden");

export const notFound = (message: string) => new ApiError(404, message);

const conflict = (message: string, cause: unknown) => new ApiError(409, message, { cause });

const unavailable = (message: string, cause: unknown) => new ApiError(503, message, { cause, retryable: true });

export const internal = (cause: unknown, details?: unknown) =>
  new ApiError(500, "Something went wrong handling this request.", { cause, details });

const fromDynamoDb = (err: DynamoDBServiceException): ApiError => {
  switch (err.name) {
    case "ConditionalCheckFailedException":
    case "TransactionConflictException":
      return conflict("The item was modified by another request. Please retry.", err);
    case "RequestLimitExceeded":
    case "ProvisionedThroughputExceededException":
    case "ThrottlingException":
    case "InternalServerError":
      return unavailable("The data store is busy. Please retry shortly.", err);
    case "RequestEntityTooLargeException":
      return new ApiError(413, "The product data is too large to store.", { cause: err });
    case "ItemCollectionSizeLimitExceededException":
      return internal(err);
    default:
      return err.$retryable ? unavailable("The data store is unavailable. Please retry shortly.", err) : internal(err);
  }
};

export const toApiError = (err: unknown): ApiError => {
  if (err instanceof ApiError) {
    return err;
  }
  if (err instanceof ZodError) {
    return badRequest("Request validation failed.", { details: treeifyError(err), cause: err });
  }
  if (err instanceof DynamoDBServiceException) {
    return fromDynamoDb(err);
  }
  return internal(err);
};

export const describeError = (err: ApiError) => {
  const cause = err.cause;
  const isService = cause instanceof DynamoDBServiceException;
  return {
    statusCode: err.statusCode,
    message: err.message,
    details: err.details,
    cause:
      cause instanceof Error
        ? {
          name: cause.name,
          message: cause.message,
          stack: cause.stack,
          requestId: isService ? cause.$metadata.requestId : undefined,
          httpStatusCode: isService ? cause.$metadata.httpStatusCode : undefined,
          attempts: isService ? cause.$metadata.attempts : undefined
        }
        : cause
  };
};
