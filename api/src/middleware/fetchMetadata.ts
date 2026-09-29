import { ErrorCode } from "@mm/lib";
import type { Request, Response, NextFunction } from "express";

import { ApiError } from "@/errors/ApiError";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const fetchMetadata = (req: Request, _res: Response, next: NextFunction) => {
  const site = req.get("Sec-Fetch-Site");
  if (SAFE_METHODS.has(req.method) || !site || site === "same-origin" || site === "none") {
    return next();
  }
  throw new ApiError(403, "Cross-site requests are not allowed.", { code: ErrorCode.CrossSiteRequest });
};
