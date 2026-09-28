import type { Request, Response, NextFunction } from "express";

import { unauthorized } from "@/errors/helpers";

export const requireUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw unauthorized();
  }
  return next();
};
