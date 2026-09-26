import type { Request, Response, NextFunction } from "express";

import { StatusCodeError } from "@/errors/StatusCodeError";

export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new StatusCodeError(401, "Unauthorized");
  }
  return next();
}
