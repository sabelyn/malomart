export class StatusCodeError extends Error {
  override readonly name = "StatusCodeError";
  public readonly statusCode: number;
  public readonly details: unknown;

  constructor(code: number, message: string, cause?: unknown, details?: unknown) {
    super(message, cause ? { cause } : undefined);

    this.statusCode = code;
    this.details = details;
  }
}
