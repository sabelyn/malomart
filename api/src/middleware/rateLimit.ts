import type { Request } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { tooManyRequests } from "@/errors/helpers";

const WINDOW_MS = 15 * 60 * 1000;

export const clientIp = (req: Request) => {
  const viewerAddress = req.get("CloudFront-Viewer-Address");
  if (viewerAddress) {
    return viewerAddress.slice(0, viewerAddress.lastIndexOf(":"));
  }
  return req.ip ?? "unknown";
};

const limiter = (limit: number) =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(clientIp(req)),
    validate: { xForwardedForHeader: false },
    handler: (_req, _res, next) => next(tooManyRequests())
  });

export const sendCodeLimit = limiter(10);
export const verifyCodeLimit = limiter(20);
