import type { input, output, ZodObject, ZodType } from "zod";
import { enum as zenum, strictObject, string, unknown } from "zod";

export const Tags = {
  Auth: "Endpoints for handling signup, signin, and other authentication-related stuff.",
  Customers: "Customers",
  Orders: "Orders",
  Products: "The shop's catalog."
} as const;
export type Tag = keyof typeof Tags;

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type Path = `/${string}`;
export type RouteAccess = "public" | "user" | "admin";
export type StatusCode = `${2 | 3 | 4 | 5}${string}`;

export type Schemas = {
  body?: ZodType;
  params?: ZodObject;
  query?: ZodObject;
  response?: ZodType;
};

type RequestPart = "body" | "params" | "query";

export type RequestInput<S extends Schemas> = {
  [K in RequestPart & keyof S]: input<S[K]>;
};

export type RequestData<S extends Schemas> = {
  [K in RequestPart & keyof S]: output<S[K]>;
};

export type ResponseOutput<S extends Schemas> = S extends { response: ZodType } ? output<S["response"]> : undefined;

export type EndpointConfig<S extends Schemas> = {
  access?: RouteAccess;
  description: string;
  errors?: {
    [key: StatusCode]: string;
  };
  id: string;
  method: HttpMethod;
  path: Path;
  schemas: S;
  successDescription: string;
  successStatus?: StatusCode;
  summary: string;
  tags?: Tag[];
};

export const ErrorCode = {
  AccountExists: "ACCOUNT_EXISTS",
  CrossSiteRequest: "CROSS_SITE_REQUEST",
  ExpiredCode: "EXPIRED_CODE",
  InvalidCode: "INVALID_CODE",
  NoPendingSignIn: "NO_PENDING_SIGN_IN",
  RateLimited: "RATE_LIMITED"
} as const;
export const ErrorCodeSchema = zenum(ErrorCode).meta({
  id: "ErrorCode",
  description: "A machine-readable code for errors a client may want to handle."
});
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ErrorResponse = strictObject({
  code: ErrorCodeSchema.optional(),
  message: string(),
  details: unknown().optional()
});
