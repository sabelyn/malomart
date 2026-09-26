import type { Request, Response, NextFunction } from "express";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { requireUser } from "./requireUser";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireUser(req, res, () => {
    if (!req.user!.isAdmin) {
      throw new StatusCodeError(403, "Forbidden");
    }
  });

  return next();
}
