import type { Request, Response, NextFunction } from "express";
import { prettifyError, ZodError } from "zod";

import { StatusCodeError } from "@/errors/StatusCodeError";

export const error = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof StatusCodeError) {
    return res.status(err.statusCode).json({ message: err.message });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: `Request failed validation: ${prettifyError(err)}`
    });
  }

  console.error(err);
  return res.status(500).json({
    message: "Something unexpected happened. Try again later."
  });
};
