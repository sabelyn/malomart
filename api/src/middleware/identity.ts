import { getItemById } from "@mm/clients";
import type { Customer } from "@mm/lib";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { NextFunction, Request, Response } from "express";
import { container } from "tsyringe";

import { userFromClaims } from "@/auth/claims";
import { readAccessToken } from "@/auth/cookies";
import { DB, USER } from "@/contracts/tokens";
import env from "@/env";
import type { User } from "@/types/user";

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
    const tokenUser = userFromClaims(await verifier.verify(token));

    let user: User = { ...tokenUser, customerData: {} };
    try {
      const customerData = await getItemById<Customer>(container.resolve(DB), env.TABLE_NAMES.customers, tokenUser.id);
      if (customerData) {
        user = { ...tokenUser, customerData };
      }
    } catch (err) {
      console.error(err);
    }

    const scopedContainer = container.createChildContainer();
    scopedContainer.registerInstance(USER, user);

    req.container = scopedContainer;
    req.user = user;
  } catch {
    return next();
  }

  return next();
};
