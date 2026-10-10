import { CognitoIdentityProviderServiceException } from "@aws-sdk/client-cognito-identity-provider";
import { ConditionalCheckFailedException, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { ErrorCode } from "@mm/lib";
import { treeifyError, ZodError } from "zod";

import { ApiError } from "./ApiError";

export const badRequest = (message: string, options?: { details?: unknown; cause?: unknown }) =>
  new ApiError(400, message, options);

export const unauthorized = (cause?: unknown, code?: ErrorCode) => new ApiError(401, "Unauthorized", { cause, code });

export const forbidden = () => new ApiError(403, "Forbidden");

export const notFound = (message: string) => new ApiError(404, message);

export const tooManyRequests = () =>
  new ApiError(429, "Too many requests. Try again later.", { code: ErrorCode.RateLimited });

export const conflict = (message: string, cause?: unknown) => new ApiError(409, message, { cause });

export const unavailable = (message: string, cause: unknown) => new ApiError(503, message, { cause, retryable: true });

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

const fromCognito = (err: CognitoIdentityProviderServiceException): ApiError => {
  switch (err.name) {
    case "CodeMismatchException":
      return new ApiError(400, "The code is incorrect.", { cause: err, code: ErrorCode.InvalidCode });
    case "ExpiredCodeException":
      return new ApiError(400, "The code has expired.", { cause: err, code: ErrorCode.ExpiredCode });
    case "InvalidParameterException":
      return badRequest("The request was rejected by the identity provider.", { cause: err });
    case "UsernameExistsException":
      return new ApiError(409, "An account already exists for this email.", {
        cause: err,
        code: ErrorCode.AccountExists
      });
    case "NotAuthorizedException":
    case "UserNotFoundException":
      return unauthorized(err);
    case "LimitExceededException":
    case "TooManyFailedAttemptsException":
    case "TooManyRequestsException":
      return new ApiError(429, "Too many attempts. Try again later.", {
        cause: err,
        code: ErrorCode.RateLimited,
        retryable: true
      });
    default:
      return err.$retryable
        ? unavailable("The identity provider is unavailable. Please retry shortly.", err)
        : internal(err);
  }
};

export const mapConditionFailure = (err: unknown, entityName: string) =>
  err instanceof ConditionalCheckFailedException ? notFound(`${entityName} could not be found.`) : err;

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
  if (err instanceof CognitoIdentityProviderServiceException) {
    return fromCognito(err);
  }
  return internal(err);
};

export const describeError = (err: ApiError) => {
  const cause = err.cause;
  const isService =
    cause instanceof DynamoDBServiceException || cause instanceof CognitoIdentityProviderServiceException;
  return {
    statusCode: err.statusCode,
    message: err.message,
    code: err.code,
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
