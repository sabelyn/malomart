import type { AnyEndpoint, Endpoint, RequestData, Schemas } from "@mm/lib/api";
import type { Request, RequestHandler, Response } from "express";
import type { input, ZodType } from "zod";
import { ZodError } from "zod";

import { internal } from "@/errors/helpers";
import { requireAdmin, requireUser } from "@/middleware";

export const pathAndMiddleware = (endpoint: AnyEndpoint, ...extra: RequestHandler[]): [string, ...RequestHandler[]] => {
  const middleware: RequestHandler[] = [...extra];
  if (endpoint.access !== "public") {
    middleware.push(endpoint.access === "admin" ? requireAdmin : requireUser);
  }
  return [endpoint.expressPath, ...middleware];
};

export const validateRequest = <S extends Schemas>(endpoint: Endpoint<S>, req: Request) => {
  const { body, params, query } = endpoint.schemas;
  return {
    body: body?.parse(req.body),
    params: params?.parse(req.params),
    query: query?.parse(req.query)
  } as RequestData<S>;
};

export const respond = <S extends Schemas & { response: ZodType }>(
  res: Response,
  endpoint: Endpoint<S>,
  body: input<S["response"]>
) => {
  let parsed: unknown;
  try {
    parsed = endpoint.schemas.response.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      throw internal(err, { endpoint: endpoint.id });
    }
    throw err;
  }
  return res.status(parseInt(endpoint.successStatus)).json(parsed);
};

export const respondEmpty = <S extends Schemas & { response?: never }>(res: Response, endpoint: Endpoint<S>) =>
  res.sendStatus(parseInt(endpoint.successStatus));
