export class ApiError extends Error {
  override readonly name = "ApiError";
  readonly statusCode: number;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    statusCode: number,
    message: string,
    options: { details?: unknown; cause?: unknown; retryable?: boolean } = {}
  ) {
    super(message, { cause: options.cause });
    this.statusCode = statusCode;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}
