import type { input, ZodType } from "zod";

import { Route } from "./Route";
import type { Body, EndpointConfig, HttpMethod, Output, Params, Query, StatusCode, ValidIncomingRequest } from "./types";

type RequestPart<K extends string, T extends ZodType | undefined> = T extends ZodType
  ? undefined extends input<T>
    ? { [P in K]?: input<T> }
    : object extends input<T>
      ? { [P in K]?: input<T> }
      : { [P in K]: input<T> }
  : { [P in K]?: never };

export type RequestInput<TBody extends Body, TParams extends Params, TQuery extends Query> = RequestPart<"body", TBody> &
  RequestPart<"params", TParams> &
  RequestPart<"query", TQuery>;

type RequestArgs<TInput> = object extends TInput ? [input?: TInput] : [input: TInput];

export type OutgoingRequest = {
  url: string;
  init: {
    method: HttpMethod;
    headers: Record<string, string>;
    body?: string;
  };
};

export class Endpoint<
  TBody extends Body = undefined,
  TParams extends Params = undefined,
  TQuery extends Query = undefined,
  TResponse extends Body = undefined
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

  request(...[input]: RequestArgs<RequestInput<TBody, TParams, TQuery>>): OutgoingRequest {
    const parts = (input ?? {}) as { body?: unknown; params?: unknown; query?: unknown };
    const body = this.bodySchema ? this.bodySchema.parse(parts.body) : undefined;
    const params = this.paramsSchema ? this.paramsSchema.parse(parts.params ?? {}) : undefined;
    const query = this.querySchema ? this.querySchema.parse(parts.query ?? {}) : undefined;

    let url = this.fullPath;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
      }
    }
    if (query) {
      const search = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          search.append(key, String(value));
        }
      }
      const queryString = search.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (body === undefined) {
      return { url, init: { method: this.method, headers } };
    }
    headers["Content-Type"] = "application/json";
    return { url, init: { method: this.method, headers, body: JSON.stringify(body) } };
  }
}

export type AnyEndpoint = Endpoint<Body, Params, Query, Body>;

export type EndpointInput<E extends AnyEndpoint> =
  E extends Endpoint<infer TBody, infer TParams, infer TQuery, Body> ? RequestInput<TBody, TParams, TQuery> : never;

export type EndpointOutput<E extends AnyEndpoint> = E extends Endpoint<Body, Params, Query, infer TResponse> ? Output<TResponse> : never;

export type EndpointRequest<E extends AnyEndpoint> =
  E extends Endpoint<infer TBody, infer TParams, infer TQuery, Body> ? ValidIncomingRequest<TBody, TParams, TQuery> : never;
