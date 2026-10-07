import type { CognitoJwtVerifier } from "aws-jwt-verify";
import { generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";

const KID = "test-key";
const USER_POOL_ID = "us-east-1_TestPool";
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
export const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

export const signJwt = (claims: Record<string, unknown> = {}, key: KeyObject = privateKey) => {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", kid: KID, typ: "JWT" });
  const payload = encode({
    sub: "user-123",
    iss: ISSUER,
    client_id: "test-client-id",
    token_use: "access",
    scope: "openid email",
    email: "user@example.com",
    name: "Regular User",
    iat: now,
    exp: now + 300,
    ...claims
  });
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key).toString("base64url");
  return `${header}.${payload}.${signature}`;
};

export const cacheTestJwks = (verifier: ReturnType<typeof CognitoJwtVerifier.create>) =>
  verifier.cacheJwks(
    { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] } as never,
    USER_POOL_ID
  );
