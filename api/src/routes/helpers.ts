import type { Body, Endpoint, Params, Query } from "@mm/lib/api";
import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { StatusCodeError } from "@/errors/StatusCodeError";
import { requireAdmin, requireUser } from "@/middleware";

type Middleware = (req: Request, res: Response, next: NextFunction) => void | Response | Promise<Response> | Promise<void>;
type AnyEndpoint = Endpoint<Body, Params, Query, Body>;

export const pathAndMiddleware = (endpoint: AnyEndpoint): [string, ...Middleware[]] => {
  const middleware: Middleware[] = [];
  if (endpoint.access !== "public") {
    middleware.push(endpoint.access === "admin" ? requireAdmin : requireUser);
  }
  return [endpoint.expressPath, ...middleware];
};

export const respond = <TEndpoint extends AnyEndpoint>(res: Response, endpoint: TEndpoint, body?: Parameters<TEndpoint["response"]>[1]) => {
  try {
    return endpoint.response(res, body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new StatusCodeError(500, "Something unexpected happened. Try again later.", err, { endpoint: endpoint.id });
    }
    throw err;
  }
};
