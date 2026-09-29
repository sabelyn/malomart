import { SessionCookie } from "@mm/lib";
import type { CognitoJwtVerifier } from "aws-jwt-verify";
import type { Request, Response } from "express";
import { generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { container } from "tsyringe";

import { USER } from "@/contracts/tokens";
import { identity } from "@/middleware/identity";

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

const mockRequest = (token?: string) =>
  ({
    cookies: token === undefined ? {} : { [SessionCookie.Access]: token }
  }) as unknown as Request;

const res = {} as Response;

const regularUser = { id: "user-123", email: "user@example.com", name: "Regular User", isAdmin: false };

beforeAll(() => {
  const verifier = captured.verifiers[0] as ReturnType<typeof CognitoJwtVerifier.create>;
  verifier.cacheJwks({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" }] } as never, USER_POOL_ID);
});

describe("identity", () => {
  it("creates the verifier from the environment", () => {
    expect(captured.verifiers).toHaveLength(1);
  });

  it.each([
    ["no access cookie", undefined],
    ["an empty access cookie", ""]
  ])("passes through anonymously with %s", async (_, token) => {
    const req = mockRequest(token);
    const next = vi.fn();

    await identity(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.container).toBe(container);
    expect(req.user).toBeUndefined();
  });

  it("sets the user from a valid access cookie", async () => {
    const req = mockRequest(signJwt());
    const next = vi.fn();

    await identity(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.user).toEqual(regularUser);
  });

  it("marks the user as admin when the token has the admin scope", async () => {
    const req = mockRequest(signJwt({ scope: "openid test/admin" }));

    await identity(req, res, vi.fn());

    expect(req.user).toEqual({ ...regularUser, isAdmin: true });
  });

  it("registers the user in a child container scoped to the request", async () => {
    const req = mockRequest(signJwt());

    await identity(req, res, vi.fn());

    expect(req.container).not.toBe(container);
    expect(req.container.resolve(USER)).toBe(req.user);
    expect(container.isRegistered(USER)).toBe(false);
  });

  it.each([
    ["an invalid signature", () => signJwt({}, otherPrivateKey)],
    ["an expired token", () => signJwt({ iat: 1000, exp: 2000 })],
    ["the wrong client", () => signJwt({ client_id: "other-client" })],
    ["the wrong issuer", () => signJwt({ iss: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Other" })],
    ["an id token", () => signJwt({ token_use: "id" })],
    ["a malformed token", () => "not.a.jwt"]
  ])("treats %s as anonymous", async (_, makeToken) => {
    const req = mockRequest(makeToken());
    const next = vi.fn();

    await identity(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.container).toBe(container);
    expect(req.user).toBeUndefined();
  });
});
