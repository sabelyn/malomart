import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";

import { userFromClaims } from "@/auth/claims";
import { readAccessToken } from "@/auth/cookies";
import { USER } from "@/contracts/tokens";
import env from "@/env";

const verifier = CognitoJwtVerifier.create({
  clientId: env.USER_POOL_CLIENT_ID,
  userPoolId: env.USER_POOL_ID,
  tokenUse: "access"
});

export const identity = async (req: Request, res: Response, next: NextFunction) => {
  req.container = container;

  const token = readAccessToken(req);
  if (!token) {
    return next();
  }

  try {
    const user = userFromClaims(await verifier.verify(token));

    const scopedContainer = container.createChildContainer();
    scopedContainer.registerInstance(USER, user);

    req.container = scopedContainer;
    req.user = user;
  } catch {
    return next();
  }

  return next();
};
