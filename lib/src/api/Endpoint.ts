import { Route } from "./Route";
import type { EndpointConfig, HttpMethod, RequestInput, Schemas, StatusCode } from "./types";

export type OutgoingRequest = {
  url: string;
  init: {
    method: HttpMethod;
    headers: Record<string, string>;
    body?: string;
  };
};

export class Endpoint<S extends Schemas> extends Route {
  readonly description: string;
  readonly errors: Record<number, string>;
  readonly id: string;
  readonly method: HttpMethod;
  readonly schemas: S;
  readonly successDescription: string;
  readonly successStatus: StatusCode;
  readonly summary: string;

  constructor(parent: Route, config: EndpointConfig<S>) {
    super(config.path, config.access ?? parent.access, config.tags, parent);

    this.description = config.description;
    this.errors = config.errors ?? {};
    this.id = config.id;
    this.method = config.method;
    this.schemas = config.schemas;
    this.successDescription = config.successDescription;
    this.successStatus = config.successStatus ?? "200";
    this.summary = config.summary;
  }

  request(input: RequestInput<S>): OutgoingRequest {
    const parts: { body?: unknown; params?: unknown; query?: unknown } = input;
    const body = this.schemas.body?.parse(parts.body);
    const params = this.schemas.params?.parse(parts.params);
    const query = this.schemas.query?.parse(parts.query);

    let url = this.fullPath;
    for (const [key, value] of Object.entries(params ?? {})) {
      url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        search.append(key, String(value));
      }
    }
    if (search.size > 0) {
      url = `${url}?${search}`;
    }

    const headers: Record<string, string> = { Accept: "application/json" };
    if (body === undefined) {
      return { url, init: { method: this.method, headers } };
    }
    headers["Content-Type"] = "application/json";
    return { url, init: { method: this.method, headers, body: JSON.stringify(body) } };
  }
}

export type AnyEndpoint = Endpoint<Schemas>;
