import type { NextFunction, Request, Response } from "express";

import { describeError, toApiError } from "@/errors/helpers";

export const error = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  const apiError = toApiError(err);
  if (shouldLog(apiError.statusCode)) {
    console.error(describeError(apiError));
  }
  if (apiError.retryable) {
    res.set("Retry-After", RETRY_AFTER_SECONDS);
  }
  return res.status(apiError.statusCode).json({ message: apiError.message, code: apiError.code, details: apiError.details });
};

const RETRY_AFTER_SECONDS = "5";

const NO_LOG_CODES = [401, 403];
const shouldLog = (statusCode: number) => !NO_LOG_CODES.includes(statusCode);
