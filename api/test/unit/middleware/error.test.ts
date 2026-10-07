import { ErrorCode } from "@mm/lib";
import type { Request, Response } from "express";
import type { MockInstance } from "vitest";
import { number, strictObject } from "zod";

import { ApiError } from "@/errors/ApiError";
import { error } from "@/middleware/error";

const mockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
    set: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.set.mockReturnValue(res);
  return res;
};

const handle = (err: Error) => {
  const res = mockResponse();
  const next = vi.fn();
  error(err, {} as Request, res as unknown as Response, next);
  return { res, next };
};

let log: MockInstance<typeof console.error>;

beforeEach(() => {
  log = vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("error", () => {
  it("includes the error code when there is one", () => {
    const { res } = handle(new ApiError(400, "The code is incorrect.", { code: ErrorCode.InvalidCode }));

    expect(res.json).toHaveBeenCalledWith({
      message: "The code is incorrect.",
      code: ErrorCode.InvalidCode,
      details: undefined
    });
  });

  it("responds with the status, message, and details of an ApiError", () => {
    const { res, next } = handle(new ApiError(400, "Bad cursor", { details: { cursor: "abc" } }));

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Bad cursor", details: { cursor: "abc" } });
    expect(next).not.toHaveBeenCalled();
  });

  it.each([401, 403])("does not log %i errors", statusCode => {
    handle(new ApiError(statusCode, "Nope"));

    expect(log).not.toHaveBeenCalled();
  });

  it.each([400, 404, 500, 503])("logs %i errors", statusCode => {
    handle(new ApiError(statusCode, "Oops"));

    expect(log).toHaveBeenCalledWith(expect.objectContaining({ statusCode, message: "Oops" }));
  });

  it("sets Retry-After for retryable errors", () => {
    const { res } = handle(new ApiError(503, "Busy", { retryable: true }));

    expect(res.set).toHaveBeenCalledWith("Retry-After", expect.any(String));
  });

  it("does not set Retry-After for non-retryable errors", () => {
    const { res } = handle(new ApiError(500, "Broken"));

    expect(res.set).not.toHaveBeenCalled();
  });

  it("responds with a 400 and the validation issues for a ZodError", () => {
    const result = strictObject({ price: number() }).safeParse({ price: "free" });

    const { res } = handle(result.error!);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ message, details }] = res.json.mock.lastCall!;
    expect(message).toBe("Request validation failed.");
    expect(details).toMatchObject({ properties: { price: expect.anything() } });
  });

  it("hides details of unexpected errors behind a 500 and logs the cause", () => {
    const err = new Error("database exploded");

    const { res } = handle(err);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Something went wrong handling this request.",
      details: undefined
    });
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, cause: expect.objectContaining({ message: "database exploded" }) })
    );
  });
});
