import { CognitoIdentityProviderServiceException } from "@aws-sdk/client-cognito-identity-provider";
import { ErrorCode, SessionCookie } from "@mm/lib";
import request from "supertest";
import type { Response } from "supertest";
import { container } from "tsyringe";

import type { AuthTokens, IAuthService } from "@/contracts";
import { AUTH_SERVICE } from "@/contracts/tokens";
import api from "@/routes";
import { asRegularUser, createTestApp } from "../../helpers/testApp";

vi.mock("@/middleware/rateLimit", () => ({
  sendCodeLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  verifyCodeLimit: (_req: unknown, _res: unknown, next: () => void) => next()
}));

const EMAIL = "link@hyrule.com";

const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

const accessToken = (claims: Record<string, unknown> = {}) =>
  [
    encode({ alg: "RS256", kid: "test-key" }),
    encode({ sub: "user-123", email: EMAIL, name: "Link", scope: "openid", token_use: "access", ...claims }),
    "signature"
  ].join(".");

const tokens = (overrides: Partial<AuthTokens> = {}): AuthTokens => ({
  accessToken: accessToken(),
  expiresIn: 900,
  refreshToken: "refresh-token",
  ...overrides
});

const signedInUser = { id: "user-123", email: EMAIL, name: "Link", isAdmin: false };

const pendingCookie = (email = EMAIL, session = "pending-session") =>
  `${SessionCookie.Pending}=${encode({ email, session })}`;

const setCookies = (res: Response) => {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return Object.fromEntries((header ?? []).map(cookie => [cookie.slice(0, cookie.indexOf("=")), cookie]));
};

const isCleared = (cookie: string | undefined) => cookie !== undefined && cookie.includes("Expires=Thu, 01 Jan 1970");

const cognitoError = (name: string) =>
  new CognitoIdentityProviderServiceException({ name, $fault: "client", $metadata: {}, message: name });

const app = createTestApp(api);

let service: { [K in keyof IAuthService]: ReturnType<typeof vi.fn<IAuthService[K]>> };

beforeEach(() => {
  service = {
    confirmSignUp: vi.fn<IAuthService["confirmSignUp"]>().mockResolvedValue(tokens()),
    refresh: vi.fn<IAuthService["refresh"]>().mockResolvedValue(tokens()),
    signOut: vi.fn<IAuthService["signOut"]>().mockResolvedValue(),
    signUp: vi.fn<IAuthService["signUp"]>().mockResolvedValue({ email: EMAIL, session: "signup-session" }),
    startSignIn: vi.fn<IAuthService["startSignIn"]>().mockResolvedValue({ email: EMAIL, session: "signin-session" }),
    verifySignIn: vi.fn<IAuthService["verifySignIn"]>().mockResolvedValue(tokens())
  };
  container.registerInstance(AUTH_SERVICE, service);
});

describe("POST /api/auth/sign-up", () => {
  it("signs up and stores the pending session in a secure cookie", async () => {
    const res = await request(app).post("/api/auth/sign-up").send({ email: EMAIL, name: "Link" });

    expect(res.status).toBe(202);
    expect(service.signUp).toHaveBeenCalledWith(EMAIL, "Link");
    const cookie = setCookies(res)[SessionCookie.Pending];
    expect(cookie).toContain(`${SessionCookie.Pending}=${encode({ email: EMAIL, session: "signup-session" })}`);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Path=\//);
  });

  it("skips the pending cookie when there is no session", async () => {
    service.signUp.mockResolvedValue(undefined);

    const res = await request(app).post("/api/auth/sign-up").send({ email: EMAIL, name: "Link" });

    expect(res.status).toBe(202);
    expect(setCookies(res)[SessionCookie.Pending]).toBeUndefined();
  });

  it.each([
    ["an invalid email", { email: "nope", name: "Link" }],
    ["a missing name", { email: EMAIL }],
    ["an extra field", { email: EMAIL, name: "Link", password: "hunter2" }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post("/api/auth/sign-up").send(body);

    expect(res.status).toBe(400);
    expect(service.signUp).not.toHaveBeenCalled();
  });

  it("returns a 409 with a code when the account exists", async () => {
    service.signUp.mockRejectedValue(cognitoError("UsernameExistsException"));

    const res = await request(app).post("/api/auth/sign-up").send({ email: EMAIL, name: "Link" });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.AccountExists);
  });
});

describe("POST /api/auth/sign-up/confirm", () => {
  it("confirms with the pending session and signs the user in", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up/confirm")
      .set("Cookie", pendingCookie())
      .send({ email: EMAIL, code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: signedInUser });
    expect(service.confirmSignUp).toHaveBeenCalledWith(EMAIL, "123456", "pending-session");
    const cookies = setCookies(res);
    expect(cookies[SessionCookie.Access]).toContain("Max-Age=900");
    expect(cookies[SessionCookie.Refresh]).toMatch(/Path=\/api\/auth/);
    expect(isCleared(cookies[SessionCookie.Pending])).toBe(true);
  });

  it("ignores a pending session for a different email", async () => {
    await request(app)
      .post("/api/auth/sign-up/confirm")
      .set("Cookie", pendingCookie("someone@else.com"))
      .send({ email: EMAIL, code: "123456" });

    expect(service.confirmSignUp).toHaveBeenCalledWith(EMAIL, "123456", undefined);
  });

  it("ignores a malformed pending cookie", async () => {
    await request(app)
      .post("/api/auth/sign-up/confirm")
      .set("Cookie", `${SessionCookie.Pending}=garbage`)
      .send({ email: EMAIL, code: "123456" });

    expect(service.confirmSignUp).toHaveBeenCalledWith(EMAIL, "123456", undefined);
  });

  it("returns a null user when the account was confirmed without signing in", async () => {
    service.confirmSignUp.mockResolvedValue(undefined);

    const res = await request(app).post("/api/auth/sign-up/confirm").send({ email: EMAIL, code: "123456" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ user: null });
    expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
  });

  it("returns a 400 with a code for a wrong code", async () => {
    service.confirmSignUp.mockRejectedValue(cognitoError("CodeMismatchException"));

    const res = await request(app).post("/api/auth/sign-up/confirm").send({ email: EMAIL, code: "123456" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.InvalidCode);
  });

  it("rejects a malformed code with a 400", async () => {
    const res = await request(app).post("/api/auth/sign-up/confirm").send({ email: EMAIL, code: "abc" });

    expect(res.status).toBe(400);
    expect(service.confirmSignUp).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/sign-in", () => {
  it("starts sign-in and stores the pending session", async () => {
    const res = await request(app).post("/api/auth/sign-in").send({ email: EMAIL });

    expect(res.status).toBe(202);
    expect(service.startSignIn).toHaveBeenCalledWith(EMAIL);
    expect(setCookies(res)[SessionCookie.Pending]).toContain(encode({ email: EMAIL, session: "signin-session" }));
  });

  it("rejects an invalid email with a 400", async () => {
    const res = await request(app).post("/api/auth/sign-in").send({ email: "nope" });

    expect(res.status).toBe(400);
  });
});

describe("POST /api/auth/sign-in/verify", () => {
  it("verifies the code, sets session cookies, and returns the user", async () => {
    const res = await request(app).post("/api/auth/sign-in/verify").set("Cookie", pendingCookie()).send({ code: "12345678" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(signedInUser);
    expect(service.verifySignIn).toHaveBeenCalledWith({ email: EMAIL, session: "pending-session" }, "12345678");
    const cookies = setCookies(res);
    expect(cookies[SessionCookie.Access]).toMatch(/HttpOnly/);
    expect(cookies[SessionCookie.Refresh]).toMatch(/HttpOnly/);
    expect(isCleared(cookies[SessionCookie.Pending])).toBe(true);
  });

  it("marks admins from the token scope", async () => {
    service.verifySignIn.mockResolvedValue(tokens({ accessToken: accessToken({ scope: "openid test/admin" }) }));

    const res = await request(app).post("/api/auth/sign-in/verify").set("Cookie", pendingCookie()).send({ code: "12345678" });

    expect(res.body.isAdmin).toBe(true);
  });

  it("returns a 401 with a code when no sign-in is pending", async () => {
    const res = await request(app).post("/api/auth/sign-in/verify").send({ code: "12345678" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCode.NoPendingSignIn);
    expect(service.verifySignIn).not.toHaveBeenCalled();
  });

  it("keeps the pending session after a wrong code", async () => {
    service.verifySignIn.mockRejectedValue(cognitoError("CodeMismatchException"));

    const res = await request(app).post("/api/auth/sign-in/verify").set("Cookie", pendingCookie()).send({ code: "12345678" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.InvalidCode);
    expect(setCookies(res)[SessionCookie.Pending]).toBeUndefined();
  });

  it("clears the pending session when Cognito rejects it", async () => {
    service.verifySignIn.mockRejectedValue(cognitoError("NotAuthorizedException"));

    const res = await request(app).post("/api/auth/sign-in/verify").set("Cookie", pendingCookie()).send({ code: "12345678" });

    expect(res.status).toBe(401);
    expect(isCleared(setCookies(res)[SessionCookie.Pending])).toBe(true);
  });
});

describe("POST /api/auth/refresh", () => {
  it("refreshes the session cookies", async () => {
    const res = await request(app).post("/api/auth/refresh").set("Cookie", `${SessionCookie.Refresh}=old-refresh`);

    expect(res.status).toBe(204);
    expect(service.refresh).toHaveBeenCalledWith("old-refresh");
    const cookies = setCookies(res);
    expect(cookies[SessionCookie.Access]).toBeDefined();
    expect(cookies[SessionCookie.Refresh]).toContain(`${SessionCookie.Refresh}=refresh-token`);
  });

  it("keeps the existing refresh cookie when Cognito does not rotate it", async () => {
    service.refresh.mockResolvedValue(tokens({ refreshToken: undefined }));

    const res = await request(app).post("/api/auth/refresh").set("Cookie", `${SessionCookie.Refresh}=old-refresh`);

    expect(res.status).toBe(204);
    expect(setCookies(res)[SessionCookie.Refresh]).toBeUndefined();
  });

  it("returns a 401 and clears cookies without a refresh cookie", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
    expect(service.refresh).not.toHaveBeenCalled();
    expect(isCleared(setCookies(res)[SessionCookie.Access])).toBe(true);
  });

  it("returns a 401 and clears cookies when the refresh token is rejected", async () => {
    service.refresh.mockRejectedValue(cognitoError("NotAuthorizedException"));

    const res = await request(app).post("/api/auth/refresh").set("Cookie", `${SessionCookie.Refresh}=revoked`);

    expect(res.status).toBe(401);
    const cookies = setCookies(res);
    expect(isCleared(cookies[SessionCookie.Access])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Refresh])).toBe(true);
  });

  it("keeps cookies when Cognito is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.refresh.mockRejectedValue(new Error("boom"));

    const res = await request(app).post("/api/auth/refresh").set("Cookie", `${SessionCookie.Refresh}=old-refresh`);

    expect(res.status).toBe(500);
    expect(setCookies(res)[SessionCookie.Refresh]).toBeUndefined();
  });
});

describe("POST /api/auth/sign-out", () => {
  it("revokes the refresh token and clears cookies", async () => {
    const res = await request(app).post("/api/auth/sign-out").set("Cookie", `${SessionCookie.Refresh}=refresh`);

    expect(res.status).toBe(204);
    expect(service.signOut).toHaveBeenCalledWith("refresh");
    const cookies = setCookies(res);
    expect(isCleared(cookies[SessionCookie.Access])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Refresh])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Pending])).toBe(true);
  });

  it("still signs out when revocation fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    service.signOut.mockRejectedValue(new Error("boom"));

    const res = await request(app).post("/api/auth/sign-out").set("Cookie", `${SessionCookie.Refresh}=refresh`);

    expect(res.status).toBe(204);
    expect(isCleared(setCookies(res)[SessionCookie.Access])).toBe(true);
  });

  it("clears cookies without calling Cognito when there is no refresh cookie", async () => {
    const res = await request(app).post("/api/auth/sign-out");

    expect(res.status).toBe(204);
    expect(service.signOut).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/me", () => {
  it("returns the current user", async () => {
    const res = await request(app).get("/api/auth/me").set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: "user-123", email: "user@example.com", name: "Regular User", isAdmin: false });
  });

  it("returns a 401 when signed out", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});
