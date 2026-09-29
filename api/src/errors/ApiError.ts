import type { ErrorCode } from "@mm/lib";

export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly statusCode: number;
  readonly code?: ErrorCode;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: { code?: ErrorCode; details?: unknown; cause?: unknown; retryable?: boolean } = {}
  ) {
    super(message, { cause: options.cause });
    this.statusCode = statusCode;
    this.code = options.code;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}
