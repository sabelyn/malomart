import { SessionCookie } from "@mm/lib/auth";
import { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayRequestSimpleAuthorizerHandlerV2 } from "aws-lambda";

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID!,
  clientId: process.env.USER_POOL_CLIENT_ID!,
  tokenUse: "access"
});

export const readCookie = (cookies: string[] | undefined, name: string) => {
  for (const cookie of cookies ?? []) {
    const separator = cookie.indexOf("=");
    if (separator > 0 && cookie.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};

export const handler: APIGatewayRequestSimpleAuthorizerHandlerV2 = async event => {
  const token = readCookie(event.cookies, SessionCookie.Access);
  if (!token) {
    throw new Error("Unauthorized");
  }

  let customerId: string;
  try {
    ({ sub: customerId } = await verifier.verify(token));
  } catch {
    throw new Error("Unauthorized");
  }
  return { isAuthorized: true, context: { customerId } };
};
