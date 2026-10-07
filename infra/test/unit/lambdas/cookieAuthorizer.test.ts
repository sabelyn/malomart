import { SessionCookie } from "@mm/lib/auth";
import type { CognitoJwtVerifier } from "aws-jwt-verify";
import type { APIGatewayRequestAuthorizerEventV2, Context } from "aws-lambda";
import { generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";

import { handler, readCookie } from "../../../src/lambdas/cookieAuthorizer";

const captured = vi.hoisted(() => ({ verifiers: [] as unknown[] }));

vi.mock("aws-jwt-verify", async importOriginal => {
  const actual = await importOriginal<typeof import("aws-jwt-verify")>();
  return {
    ...actual,
    CognitoJwtVerifier: {
      create: (...args: Parameters<typeof actual.CognitoJwtVerifier.create>) => {
        const verifier = actual.CognitoJwtVerifier.create(...args);
        captured.verifiers.push(verifier);
        return verifier;
      }
    }
  };
});

const KID = "test-key";
const USER_POOL_ID = "us-east-1_TestPool";
const ISSUER = `https://cognito-idp.us-east-1.amazonaws.com/${USER_POOL_ID}`;

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const { privateKey: otherPrivateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const signJwt = (claims: Record<string, unknown> = {}, key: KeyObject = privateKey) => {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: "RS256", kid: KID, typ: "JWT" });
  const payload = encode({
    sub: "user-123",
    iss: ISSUER,
    client_id: "test-client-id",
    token_use: "access",
    scope: "openid",
    iat: now,
    exp: now + 300,
    ...claims
  });
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), key).toString("base64url");
  return `${header}.${payload}.${signature}`;
};

const invoke = (cookies?: string[]) =>
  handler({ cookies } as APIGatewayRequestAuthorizerEventV2, {} as Context, () => undefined);

beforeAll(() => {
  const verifier = captured.verifiers[0] as ReturnType<typeof CognitoJwtVerifier.create>;
  verifier.cacheJwks(
    { keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] } as never,
    USER_POOL_ID
  );
});

describe("readCookie", () => {
  it.each([
    ["no cookies", undefined, undefined],
    ["a missing cookie", ["other=1"], undefined],
    ["a matching cookie", ["other=1", `${SessionCookie.Access}=abc`], "abc"],
    ["a value containing '='", [`${SessionCookie.Access}=a=b`], "a=b"],
    ["an encoded value", [`${SessionCookie.Access}=a%20b`], "a b"],
    ["a malformed encoding", [`${SessionCookie.Access}=%E0%A4%A`], undefined],
    ["a cookie whose name only starts with the target", [`${SessionCookie.Access}x=abc`], undefined]
  ])("handles %s", (_, cookies, expected) => {
    expect(readCookie(cookies, SessionCookie.Access)).toBe(expected);
  });
});

describe("handler", () => {
  it("creates the verifier from the environment", () => {
    expect(captured.verifiers).toHaveLength(1);
  });

  it("authorizes a valid access cookie", async () => {
    await expect(invoke([`${SessionCookie.Access}=${signJwt()}`])).resolves.toEqual({ isAuthorized: true });
  });

  it("authorizes admins and users alike, leaving admin checks to the API", async () => {
    await expect(invoke([`${SessionCookie.Access}=${signJwt({ scope: "openid malomart/admin" })}`])).resolves.toEqual({
      isAuthorized: true
    });
  });

  it.each([
    ["no cookies", undefined],
    ["only other cookies", [`${SessionCookie.Pending}=pending`]],
    ["an invalid signature", [`${SessionCookie.Access}=${signJwt({}, otherPrivateKey)}`]],
    ["an expired token", [`${SessionCookie.Access}=${signJwt({ iat: 1000, exp: 2000 })}`]],
    ["the wrong client", [`${SessionCookie.Access}=${signJwt({ client_id: "other-client" })}`]],
    ["an id token", [`${SessionCookie.Access}=${signJwt({ token_use: "id" })}`]],
    ["a malformed token", [`${SessionCookie.Access}=not.a.jwt`]]
  ])("rejects %s with Unauthorized so API Gateway returns a 401", async (_, cookies) => {
    await expect(invoke(cookies)).rejects.toThrow("Unauthorized");
  });
});
