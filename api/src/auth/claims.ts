import { decomposeUnverifiedJwt } from "aws-jwt-verify/jwt";
import type { JwtPayload } from "aws-jwt-verify/jwt-model";

import env from "@/env";
import type { User } from "@/types/user";

export const userFromClaims = (claims: JwtPayload): User => ({
  id: String(claims.sub),
  email: String(claims.email ?? ""),
  name: String(claims.name ?? ""),
  isAdmin: typeof claims.scope === "string" && claims.scope.split(" ").includes(env.ADMIN_SCOPE)
});

export const userFromIssuedToken = (accessToken: string) => userFromClaims(decomposeUnverifiedJwt(accessToken).payload);
