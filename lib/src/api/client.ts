import type { Endpoint } from "./Endpoint";
import type { ErrorCode, RequestInput, ResponseOutput, Schemas } from "./types";
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

export class NetworkError extends Error {
  override readonly name = "NetworkError";

  constructor(cause: unknown) {
    super("The request could not reach the server.", { cause });
  }
}

export type CallOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  signal?: AbortSignal;
  validateResponse?: boolean;
};

const toRequestError = async (response: Response) => {
  const parsed = ErrorResponse.safeParse(await response.json().catch(() => undefined));
  if (!parsed.success) {
    return new ApiRequestError(
      response.status,
      response.statusText || `Request failed with status ${response.status}.`
    );
  }
  const { message, code, details } = parsed.data;
  return new ApiRequestError(response.status, message, { code, details });
};

export const call = async <S extends Schemas>(
  endpoint: Endpoint<S>,
  input: RequestInput<S>,
  options: CallOptions = {}
): Promise<ResponseOutput<S>> => {
  const { url, init } = endpoint.request(input);
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(`${options.baseUrl ?? ""}${url}`, { ...init, signal: options.signal });
  } catch (err) {
    if (options.signal?.aborted) {
      throw err;
    }
    throw new NetworkError(err);
  }

  if (!response.ok) {
    throw await toRequestError(response);
  }

  const schema = endpoint.schemas.response;
  if (!schema) {
    return undefined as ResponseOutput<S>;
  }
  const body: unknown = await response.json();
  return (options.validateResponse ? schema.parse(body) : body) as ResponseOutput<S>;
};
