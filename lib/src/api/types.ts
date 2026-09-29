import type { input, output, ZodObject, ZodType } from "zod";
import { enum as zenum, strictObject, string, unknown } from "zod";

export const Tags = {
  Auth: "Endpoints for handling signup, signin, and other authentication-related stuff.",
  Products: "The shop's catalog."
} as const;
export type Tag = keyof typeof Tags;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Input<T extends ZodType | undefined> = T extends undefined ? undefined : input<T>;
export type Output<T extends ZodType | undefined> = T extends undefined ? undefined : output<T>;
export type Path = `/${string}`;
export type RouteAccess = "public" | "user" | "admin";
export type StatusCode = `${2 | 3 | 4 | 5}${string}`;

export type Body = ZodType | undefined;
export type Params = ZodObject | undefined;
export type Query = ZodObject | undefined;

export type EndpointConfig<
  TBody extends Body = undefined,
  TParams extends Params = undefined,
  TQuery extends Query = undefined,
  TResponse extends Body = undefined
> = {
  access?: RouteAccess;
  bodySchema?: TBody;
  description: string;
  errors?: {
    [key: StatusCode]: string;
  };
  id: string;
  method: HttpMethod;
  paramsSchema?: TParams;
  path: Path;
  querySchema?: TQuery;
  responseSchema?: TResponse;
  successDescription: string;
  successStatus?: StatusCode;
  summary: string;
  tags?: Tag[];
}

export type ValidIncomingRequest<
  TBody extends ZodType | undefined = undefined,
  TParams extends ZodObject | undefined = undefined,
  TQuery extends ZodObject | undefined = undefined
> = {
  params: Output<TParams>;
  query: Output<TQuery>;
  body: Output<TBody>;
}

export const ErrorCode = {
  AccountExists: "ACCOUNT_EXISTS",
  CrossSiteRequest: "CROSS_SITE_REQUEST",
  ExpiredCode: "EXPIRED_CODE",
  InvalidCode: "INVALID_CODE",
  NoPendingSignIn: "NO_PENDING_SIGN_IN",
  RateLimited: "RATE_LIMITED"
} as const;
export const ErrorCodeSchema = zenum(ErrorCode)
  .meta({ id: "ErrorCode", description: "A machine-readable code for errors a client may want to handle." });
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorResponse = strictObject({
  code: ErrorCodeSchema.optional(),
  message: string(),
  details: unknown().optional()
});
