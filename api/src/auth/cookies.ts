import { auth, SessionCookie } from "@mm/lib";
import type { CookieOptions, Request, Response } from "express";
import { strictObject, string } from "zod";

import type { AuthTokens, PendingAuth } from "@/contracts";

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const PENDING_TTL_MS = 10 * 60 * 1000;

const baseOptions: CookieOptions = { httpOnly: true, secure: true, sameSite: "strict", path: "/" };
const refreshOptions: CookieOptions = { ...baseOptions, path: auth.fullPath };

const PendingCookie = strictObject({ email: string(), session: string() });

export const readAccessToken = (req: Request): string | undefined => req.cookies?.[SessionCookie.Access];

export const readRefreshToken = (req: Request): string | undefined => req.cookies?.[SessionCookie.Refresh];

export const readPendingAuth = (req: Request): PendingAuth | undefined => {
  const raw = req.cookies?.[SessionCookie.Pending];
  if (typeof raw !== "string") {
    return undefined;
  }
  try {
    const result = PendingCookie.safeParse(JSON.parse(Buffer.from(raw, "base64url").toString("utf8")));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
};

export const setPendingAuth = (res: Response, pending: PendingAuth) =>
  res.cookie(SessionCookie.Pending, Buffer.from(JSON.stringify(pending)).toString("base64url"), {
    ...baseOptions,
    maxAge: PENDING_TTL_MS
  });

export const clearPendingAuth = (res: Response) => res.clearCookie(SessionCookie.Pending, baseOptions);

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
