import type { Request, Response } from "express";

import { Route } from "./Route";
import type { Body, EndpointConfig, HttpMethod, Input, Output, Params, Query, StatusCode, ValidIncomingRequest } from "./types";

export class Endpoint<
  TBody extends Body,
  TParams extends Params,
  TQuery extends Query,
  TResponse extends Body | undefined
> extends Route {
  readonly bodySchema: TBody | undefined;
  readonly description: string;
  readonly errors: Record<number, string>;
  readonly id: string;
  readonly method: HttpMethod;
  readonly paramsSchema: TParams | undefined;
  readonly querySchema: TQuery | undefined;
  readonly responseSchema: TResponse | undefined;
  readonly successDescription: string;
  readonly successStatus: StatusCode;
  readonly summary: string;

  constructor(parent: Route, config: EndpointConfig<TBody, TParams, TQuery, TResponse>) {
    super(config.path, config.access ?? parent.access, config.tags, parent);

    this.bodySchema = config.bodySchema;
    this.description = config.description;
    this.errors = config.errors ?? {};
    this.id = config.id;
    this.method = config.method;
    this.paramsSchema = config.paramsSchema;
    this.querySchema = config.querySchema;
    this.responseSchema = config.responseSchema;
    this.successDescription = config.successDescription;
    this.successStatus = config.successStatus ?? "200";
    this.summary = config.summary;
  }

  request = (bodyInput?: Input<TBody>, paramsInput?: Input<TParams>, queryInput?: Input<TQuery>, token?: string) => {
    const body = this.bodySchema ? this.bodySchema.parse(bodyInput) : undefined;
    const params = this.paramsSchema ? this.paramsSchema.parse(paramsInput) : undefined;
    const query = this.querySchema ? this.querySchema.parse(queryInput) : undefined;

    let path = this.fullPath;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`{${key}}`, String(value));
      }
    }
    if (query) {
      const parts: string[] = [];
      for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null) {
          continue;
        }
        parts.push(`${key}=${encodeURIComponent(String(value))}`);
      }
      if (parts.length > 0) {
        path = `${path}?${parts.join("&")}`;
      }
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    } else if (this.access !== "public") {
      throw new Error(`Non-public endpoint ${this.fullPath} requires a bearer token.`);
    }

    return { path, method: this.method, body, headers };
  }

  response = (res: Response, body?: Input<TResponse>) => {
    const status = parseInt(this.successStatus);
    if (this.responseSchema) {
      const resBody = this.responseSchema.parse(body);
      return res.status(status).json(resBody);
    }
    return res.sendStatus(status);
  }

  validateRequest = (req: Request): ValidIncomingRequest<TBody, TParams, TQuery> => ({
    body: (this.bodySchema ? this.bodySchema.parse(req.body) : undefined) as Output<TBody>,
    params: (this.paramsSchema ? this.paramsSchema.parse(req.params) : undefined) as Output<TParams>,
    query: (this.querySchema ? this.querySchema.parse(req.query) : undefined) as Output<TQuery>
  });
}
