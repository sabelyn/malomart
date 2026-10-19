import { auth, SessionCookie } from "@mm/lib";
import type { CookieOptions, Request, Response } from "express";
import { boolean, strictObject, string } from "zod";
import type { infer as zinfer, ZodType } from "zod";

import type { AuthTokens, PendingAuth } from "@/contracts";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PENDING_TTL_MS = 10 * 60 * 1000;

const baseOptions: CookieOptions = { httpOnly: true, secure: true, sameSite: "strict", path: "/" };
const refreshOptions: CookieOptions = { ...baseOptions, path: auth.fullPath };

const oauthOptions: CookieOptions = { ...baseOptions, sameSite: "lax" };

const PendingCookie = strictObject({ email: string(), session: string() });

const OAuthCookie = strictObject({ state: string(), verifier: string(), returnTo: string(), retried: boolean() });
export type OAuthState = zinfer<typeof OAuthCookie>;

const encodeCookie = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const decodeCookie = <T>(raw: unknown, schema: ZodType<T>): T | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    const result = schema.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

export const readAccessToken = (req: Request): string | undefined => req.cookies?.[SessionCookie.Access];

export const readRefreshToken = (req: Request): string | undefined => req.cookies?.[SessionCookie.Refresh];

export const readPendingAuth = (req: Request): PendingAuth | undefined =>
  decodeCookie(req.cookies?.[SessionCookie.Pending], PendingCookie);

export const setPendingAuth = (res: Response, pending: PendingAuth) =>
  res.cookie(SessionCookie.Pending, encodeCookie(pending), { ...baseOptions, maxAge: PENDING_TTL_MS });

export const clearPendingAuth = (res: Response) => res.clearCookie(SessionCookie.Pending, baseOptions);

export const readOAuthState = (req: Request): OAuthState | undefined =>
  decodeCookie(req.cookies?.[SessionCookie.OAuth], OAuthCookie);

export const setOAuthState = (res: Response, state: OAuthState) =>
  res.cookie(SessionCookie.OAuth, encodeCookie(state), { ...oauthOptions, maxAge: PENDING_TTL_MS });

export const clearOAuthState = (res: Response) => res.clearCookie(SessionCookie.OAuth, oauthOptions);

export const setSessionCookies = (res: Response, tokens: AuthTokens) => {
  res.cookie(SessionCookie.Access, tokens.accessToken, { ...baseOptions, maxAge: tokens.expiresIn * 1000 });
  if (tokens.refreshToken) {
    res.cookie(SessionCookie.Refresh, tokens.refreshToken, { ...refreshOptions, maxAge: REFRESH_TTL_MS });
  }
};

export const clearSessionCookies = (res: Response) => {
  res.clearCookie(SessionCookie.Access, baseOptions);
  res.clearCookie(SessionCookie.Refresh, refreshOptions);
  clearPendingAuth(res);
};
