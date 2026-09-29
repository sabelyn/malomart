import type { AnyEndpoint, EndpointInput, EndpointOutput } from "./Endpoint";
import type { ErrorCode } from "./types";
import { ErrorResponse } from "./types";

export class ApiRequestError extends Error {
  override readonly name = "ApiRequestError";
  readonly status: number;
  readonly code?: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, message: string, options: { code?: ErrorCode; details?: unknown } = {}) {
    super(message);
    this.status = status;
    this.code = options.code;
    this.details = options.details;
  }
}

export type CallOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  validateResponse?: boolean;
};

type CallArgs<E extends AnyEndpoint> = object extends EndpointInput<E>
  ? [input?: EndpointInput<E>, options?: CallOptions]
  : [input: EndpointInput<E>, options?: CallOptions];

const readJson = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

const toRequestError = async (response: Response) => {
  const parsed = ErrorResponse.safeParse(await readJson(response));
  if (!parsed.success) {
    return new ApiRequestError(response.status, response.statusText || `Request failed with status ${response.status}.`);
  }
  const { message, code, details } = parsed.data;
  return new ApiRequestError(response.status, message, { code, details });
};

export const call = async <E extends AnyEndpoint>(endpoint: E, ...[input, options = {}]: CallArgs<E>): Promise<EndpointOutput<E>> => {
  const { url, init } = endpoint.request(input as never);
  const response = await (options.fetch ?? fetch)(`${options.baseUrl ?? ""}${url}`, { ...init, signal: options.signal });

  if (!response.ok) {
    throw await toRequestError(response);
  }
  if (!endpoint.responseSchema) {
    return undefined as EndpointOutput<E>;
  }

  const body = await readJson(response);
  return (options.validateResponse ? endpoint.responseSchema.parse(body) : body) as EndpointOutput<E>;
};
