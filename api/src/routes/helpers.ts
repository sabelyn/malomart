import type { AnyEndpoint, Body, Endpoint, EndpointRequest, Input, Params, Query } from "@mm/lib/api";
import type { Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

import { internal } from "@/errors/helpers";
import { requireAdmin, requireUser } from "@/middleware";

type ResponseInput<E extends AnyEndpoint> = E extends Endpoint<Body, Params, Query, infer TResponse> ? Input<TResponse> : never;

export const pathAndMiddleware = (endpoint: AnyEndpoint, ...extra: RequestHandler[]): [string, ...RequestHandler[]] => {
  const middleware: RequestHandler[] = [...extra];
  if (endpoint.access !== "public") {
    middleware.push(endpoint.access === "admin" ? requireAdmin : requireUser);
  }
  return [endpoint.expressPath, ...middleware];
};

export const validateRequest = <E extends AnyEndpoint>(endpoint: E, req: Request) =>
  ({
    body: endpoint.bodySchema ? endpoint.bodySchema.parse(req.body) : undefined,
    params: endpoint.paramsSchema ? endpoint.paramsSchema.parse(req.params) : undefined,
    query: endpoint.querySchema ? endpoint.querySchema.parse(req.query) : undefined
  }) as EndpointRequest<E>;

export const respond = <E extends AnyEndpoint>(res: Response, endpoint: E, body?: ResponseInput<E>) => {
  const status = parseInt(endpoint.successStatus);
  if (!endpoint.responseSchema) {
    return res.sendStatus(status);
  }

  let parsed: unknown;
  try {
    parsed = endpoint.responseSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw internal(err, { endpoint: endpoint.id });
    }
    throw err;
  }
  return res.status(status).json(parsed);
};
