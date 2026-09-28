import { ConditionalCheckFailedException, DynamoDBServiceException } from "@aws-sdk/client-dynamodb";
import { number, strictObject, ZodError } from "zod";

import { ApiError } from "@/errors/ApiError";
import { badRequest, describeError, forbidden, internal, notFound, toApiError, unauthorized } from "@/errors/helpers";

const metadata = { requestId: "req-123", httpStatusCode: 400, attempts: 2 };

const dynamoError = (name: string, retryable = false) => {
  const err = new DynamoDBServiceException({ name, $fault: "client", $metadata: metadata, message: `${name} happened` });
  if (retryable) {
    err.$retryable = { throttling: false };
  }
  return err;
};

describe("factories", () => {
  it.each([
    ["badRequest", () => badRequest("Bad"), 400],
    ["unauthorized", () => unauthorized(), 401],
    ["forbidden", () => forbidden(), 403],
    ["notFound", () => notFound("Missing"), 404],
    ["internal", () => internal(new Error("boom")), 500]
  ])("%s creates a non-retryable %i ApiError", (_, make, statusCode) => {
    const err = make();

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ statusCode, retryable: false });
  });

  it("badRequest keeps the cause and details", () => {
    const cause = new Error("bad cursor");

    expect(badRequest("Bad", { cause, details: { cursor: "x" } })).toMatchObject({ cause, details: { cursor: "x" } });
  });

  it("unauthorized keeps the cause", () => {
    const cause = new Error("expired");

    expect(unauthorized(cause).cause).toBe(cause);
  });

  it("internal uses a generic message and keeps the cause and details", () => {
    const cause = new Error("database exploded");

    expect(internal(cause, { endpoint: "op" })).toMatchObject({
      message: "Something went wrong handling this request.",
      cause,
      details: { endpoint: "op" }
    });
  });
});

describe("toApiError", () => {
  it("returns ApiErrors unchanged", () => {
    const err = notFound("Missing");

    expect(toApiError(err)).toBe(err);
  });

  it("converts a ZodError to a 400 with the validation tree as details", () => {
    const zodError = strictObject({ price: number() }).safeParse({ price: "free" }).error!;

    const err = toApiError(zodError);

    expect(err).toMatchObject({ statusCode: 400, message: "Request validation failed.", cause: zodError });
    expect(err.details).toMatchObject({ properties: { price: expect.anything() } });
  });

  it.each([
    ["ConditionalCheckFailedException", 409, false],
    ["TransactionConflictException", 409, false],
    ["RequestLimitExceeded", 503, true],
    ["ProvisionedThroughputExceededException", 503, true],
    ["ThrottlingException", 503, true],
    ["InternalServerError", 503, true],
    ["RequestEntityTooLargeException", 413, false],
    ["ItemCollectionSizeLimitExceededException", 500, false],
    ["ValidationException", 500, false]
  ])("maps DynamoDB %s to a %i", (name, statusCode, retryable) => {
    const cause = dynamoError(name);

    expect(toApiError(cause)).toMatchObject({ statusCode, retryable, cause });
  });

  it("maps DynamoDB exception subclasses by name", () => {
    const cause = new ConditionalCheckFailedException({ $metadata: metadata, message: "failed" });

    expect(toApiError(cause)).toMatchObject({ statusCode: 409, cause });
  });

  it("maps unknown retryable DynamoDB errors to a retryable 503", () => {
    const cause = dynamoError("SomethingNew", true);

    expect(toApiError(cause)).toMatchObject({ statusCode: 503, retryable: true, cause });
  });

  it.each([
    ["an Error", new Error("boom")],
    ["a non-Error value", "boom"]
  ])("converts %s to a 500", (_, cause) => {
    expect(toApiError(cause)).toMatchObject({ statusCode: 500, retryable: false, cause });
  });
});

describe("describeError", () => {
  it("includes the status, message, and details", () => {
    const described = describeError(badRequest("Bad", { details: { cursor: "x" } }));

    expect(described).toEqual({ statusCode: 400, message: "Bad", details: { cursor: "x" }, cause: undefined });
  });

  it("summarizes an Error cause", () => {
    const cause = new Error("boom");

    expect(describeError(internal(cause)).cause).toEqual({
      name: "Error",
      message: "boom",
      stack: cause.stack,
      requestId: undefined,
      httpStatusCode: undefined,
      attempts: undefined
    });
  });

  it("includes request metadata for a DynamoDB cause", () => {
    const cause = dynamoError("ThrottlingException");

    expect(describeError(toApiError(cause)).cause).toMatchObject({
      name: "ThrottlingException",
      requestId: "req-123",
      httpStatusCode: 400,
      attempts: 2
    });
  });

  it("passes through a non-Error cause", () => {
    expect(describeError(internal("boom")).cause).toBe("boom");
  });

  it("does not include ZodError internals beyond the summary", () => {
    const cause = new ZodError([]);

    expect(describeError(internal(cause)).cause).toMatchObject({ name: "ZodError" });
  });
});
