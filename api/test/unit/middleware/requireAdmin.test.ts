import type { Request, Response } from "express";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { requireAdmin } from "@/middleware/requireAdmin";

const res = {} as Response;

describe("requireAdmin", () => {
  it("calls next once when the user is an admin", () => {
    const req = { user: { id: "user-123", isAdmin: true } } as Request;
    const next = vi.fn();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it("throws a 403 when the user is not an admin", () => {
    const req = { user: { id: "user-123", isAdmin: false } } as Request;
    const next = vi.fn();

    expect(() => requireAdmin(req, res, next)).toThrow(StatusCodeError);
    expect(() => requireAdmin(req, res, next)).toThrow(expect.objectContaining({ statusCode: 403 }));
    expect(next).not.toHaveBeenCalled();
  });

  it("throws a 401 when there is no user", () => {
    const req = {} as Request;
    const next = vi.fn();

    expect(() => requireAdmin(req, res, next)).toThrow(expect.objectContaining({ statusCode: 401 }));
    expect(next).not.toHaveBeenCalled();
  });
});
