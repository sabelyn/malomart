import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";

import { USER } from "@/contracts/tokens";
import env from "@/env";
import { StatusCodeError } from "@/errors/StatusCodeError";

const verifier = CognitoJwtVerifier.create({
  clientId: env.USER_POOL_CLIENT_ID,
  userPoolId: env.USER_POOL_ID,
  tokenUse: "access"
});

export const identity = async (req: Request, res: Response, next: NextFunction) => {
  req.container = container;

  const [scheme, token] = req.get("Authorization")?.split(" ") ?? [];
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return next();
  }

  try {
    const { sub, scope } = await verifier.verify(token);
    const user = {
      id: sub,
      isAdmin: scope.split(" ").includes(env.ADMIN_SCOPE)
    };

    const scopedContainer = container.createChildContainer();
    scopedContainer.registerInstance(USER, user);

    req.container = scopedContainer;
    req.user = user;

  } catch (err) {
    throw new StatusCodeError(401, "Unauthorized", err);
  }

  return next();
}
