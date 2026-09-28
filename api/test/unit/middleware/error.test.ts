import type { Request, Response } from "express";
import { number, strictObject } from "zod";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { error } from "@/middleware/error";

const mockResponse = () => {
  const res = {
    status: vi.fn(),
    json: vi.fn()
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
};

const handle = (err: Error) => {
  const res = mockResponse();
  const next = vi.fn();
  error(err, {} as Request, res as unknown as Response, next);
  return { res, next };
};

describe("error", () => {
  it("responds with the status and message of a StatusCodeError", () => {
    const { res, next } = handle(new StatusCodeError(404, "Not found"));

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("does not log client StatusCodeErrors", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    handle(new StatusCodeError(404, "Not found"));

    expect(log).not.toHaveBeenCalled();
  });

  it("logs server StatusCodeErrors while still sending their message", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new StatusCodeError(503, "Busy");

    const { res } = handle(err);

    expect(log).toHaveBeenCalledWith(err);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ message: "Busy" });
  });

  it("responds with a 400 and the validation issues for a ZodError", () => {
    const result = strictObject({ price: number() }).safeParse({ price: "free" });

    const { res } = handle(result.error!);

    expect(res.status).toHaveBeenCalledWith(400);
    const [{ message }] = res.json.mock.lastCall!;
    expect(message).toMatch(/^Request failed validation: /);
    expect(message).toContain("price");
  });

  it("logs and hides details of unexpected errors behind a 500", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const err = new Error("database exploded");

    const { res } = handle(err);

    expect(log).toHaveBeenCalledWith(err);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Something unexpected happened. Try again later." });
  });
});
