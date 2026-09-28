import type { Request, Response } from "express";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { requireUser } from "@/middleware/requireUser";

const res = {} as Response;

describe("requireUser", () => {
  it("calls next when there is a user", () => {
    const req = { user: { id: "user-123", isAdmin: false } } as Request;
    const next = vi.fn();

    requireUser(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("throws a 401 when there is no user", () => {
    const req = {} as Request;
    const next = vi.fn();

    expect(() => requireUser(req, res, next)).toThrow(StatusCodeError);
    expect(() => requireUser(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
    expect(next).not.toHaveBeenCalled();
  });
});
