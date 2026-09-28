import type { Request, Response, NextFunction } from "express";

import { forbidden } from "@/errors/helpers";
import { requireUser } from "./requireUser";

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
  requireUser(req, res, () => {
    if (!req.user!.isAdmin) {
      throw forbidden();
    }
  });

  return next();
};
