import { CognitoIdentityProviderServiceException } from "@aws-sdk/client-cognito-identity-provider";
import { ErrorCode, SessionCookie } from "@mm/lib";
import { createHash } from "node:crypto";
import request from "supertest";
import type { Response } from "supertest";
import { container } from "tsyringe";

import type { AuthTokens, IAuthService, ICustomerService } from "@/contracts";
import { AUTH_SERVICE, CUSTOMER_SERVICE } from "@/contracts/tokens";
import api from "@/routes";
import { asRegularUser, asUser, createTestApp } from "../../helpers/testApp";

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

const signedInUser = { id: "user-123", email: EMAIL, name: "Link", isAdmin: false, signInMethod: "email" };

const GOOGLE_URL = "https://auth.malomart.test/oauth2/authorize?mock=true";
const CALLBACK_URI = "http://localhost:5173/api/auth/google/callback";

type OAuthOverrides = { purpose?: string; state?: string; returnTo?: string; retried?: boolean; userId?: string };

const oauthCookie = (overrides: OAuthOverrides = {}) =>
  `${SessionCookie.OAuth}=${encode({ purpose: "signIn", state: "oauth-state", verifier: "oauth-verifier", returnTo: "/cart", retried: false, ...overrides })}`;

const deletionCookie = (userId = "user-123") => oauthCookie({ purpose: "deleteAccount", returnTo: "/", userId });

const decodeCookie = (cookie: string) =>
  JSON.parse(Buffer.from(cookie.slice(cookie.indexOf("=") + 1, cookie.indexOf(";")), "base64url").toString("utf8"));

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

type CleanupMethods = Pick<ICustomerService, "deleteSavedData" | "deleteCustomerRecord">;
let customerService: { [K in keyof CleanupMethods]: ReturnType<typeof vi.fn<CleanupMethods[K]>> };

beforeEach(() => {
  service = {
    confirmEmailChange: vi.fn<IAuthService["confirmEmailChange"]>().mockResolvedValue(),
    confirmSignUp: vi.fn<IAuthService["confirmSignUp"]>().mockResolvedValue(tokens()),
    deleteUser: vi.fn<IAuthService["deleteUser"]>().mockResolvedValue(),
    exchangeAuthorizationCode: vi.fn<IAuthService["exchangeAuthorizationCode"]>().mockResolvedValue(tokens()),
    googleSignInUrl: vi.fn<IAuthService["googleSignInUrl"]>().mockReturnValue(GOOGLE_URL),
    refresh: vi.fn<IAuthService["refresh"]>().mockResolvedValue(tokens()),
    requestEmailChange: vi.fn<IAuthService["requestEmailChange"]>().mockResolvedValue(),
    resendSignUpCode: vi.fn<IAuthService["resendSignUpCode"]>().mockResolvedValue(),
    signOut: vi.fn<IAuthService["signOut"]>().mockResolvedValue(),
    signOutEverywhere: vi.fn<IAuthService["signOutEverywhere"]>().mockResolvedValue(),
    signUp: vi.fn<IAuthService["signUp"]>().mockResolvedValue({ email: EMAIL, session: "signup-session" }),
    startSignIn: vi.fn<IAuthService["startSignIn"]>().mockResolvedValue({ email: EMAIL, session: "signin-session" }),
    updateName: vi.fn<IAuthService["updateName"]>().mockResolvedValue(),
    verifySignIn: vi.fn<IAuthService["verifySignIn"]>().mockResolvedValue(tokens())
  };
  customerService = {
    deleteSavedData: vi.fn<ICustomerService["deleteSavedData"]>().mockResolvedValue(),
    deleteCustomerRecord: vi.fn<ICustomerService["deleteCustomerRecord"]>().mockResolvedValue()
  };
  container.registerInstance(AUTH_SERVICE, service);
  container.registerInstance(CUSTOMER_SERVICE, customerService as unknown as ICustomerService);
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

describe("POST /api/auth/sign-up/resend", () => {
  it("resends the confirmation code and keeps the pending session", async () => {
    const res = await request(app)
      .post("/api/auth/sign-up/resend")
      .set("Cookie", pendingCookie())
      .send({ email: EMAIL });

    expect(res.status).toBe(202);
    expect(service.resendSignUpCode).toHaveBeenCalledWith(EMAIL);
    expect(setCookies(res)[SessionCookie.Pending]).toBeUndefined();
  });

  it("rejects an invalid email with a 400", async () => {
    const res = await request(app).post("/api/auth/sign-up/resend").send({ email: "nope" });

    expect(res.status).toBe(400);
    expect(service.resendSignUpCode).not.toHaveBeenCalled();
  });

  it("returns a 429 when Cognito limits resends", async () => {
    service.resendSignUpCode.mockRejectedValue(cognitoError("LimitExceededException"));

    const res = await request(app).post("/api/auth/sign-up/resend").send({ email: EMAIL });

    expect(res.status).toBe(429);
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
    const res = await request(app)
      .post("/api/auth/sign-in/verify")
      .set("Cookie", pendingCookie())
      .send({ code: "12345678" });

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

    const res = await request(app)
      .post("/api/auth/sign-in/verify")
      .set("Cookie", pendingCookie())
      .send({ code: "12345678" });

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

    const res = await request(app)
      .post("/api/auth/sign-in/verify")
      .set("Cookie", pendingCookie())
      .send({ code: "12345678" });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.InvalidCode);
    expect(setCookies(res)[SessionCookie.Pending]).toBeUndefined();
  });

  it("clears the pending session when Cognito rejects it", async () => {
    service.verifySignIn.mockRejectedValue(cognitoError("NotAuthorizedException"));

    const res = await request(app)
      .post("/api/auth/sign-in/verify")
      .set("Cookie", pendingCookie())
      .send({ code: "12345678" });

    expect(res.status).toBe(401);
    expect(isCleared(setCookies(res)[SessionCookie.Pending])).toBe(true);
  });
});

describe("GET /api/auth/google", () => {
  it("redirects to Google and stores the PKCE state in a Lax cookie", async () => {
    const res = await request(app).get("/api/auth/google").query({ returnTo: "/cart" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(GOOGLE_URL);
    const cookie = setCookies(res)[SessionCookie.OAuth];
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const stored = decodeCookie(cookie);
    expect(stored).toMatchObject({ returnTo: "/cart", retried: false });
    expect(service.googleSignInUrl).toHaveBeenCalledWith(
      CALLBACK_URI,
      stored.state,
      createHash("sha256").update(stored.verifier).digest("base64url")
    );
  });

  it("falls back to the home page for an unsafe return path", async () => {
    const res = await request(app).get("/api/auth/google").query({ returnTo: "https://evil.test" });

    expect(decodeCookie(setCookies(res)[SessionCookie.OAuth])).toMatchObject({ returnTo: "/" });
  });

  it("sends the user back to sign in when Google sign-in can't start", async () => {
    service.googleSignInUrl.mockImplementation(() => {
      throw new Error("not configured");
    });

    const res = await request(app).get("/api/auth/google").query({ returnTo: "/cart" });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/sign-in?googleError=failed&returnTo=%2Fcart");
  });
});

describe("GET /api/auth/google/callback", () => {
  const LINKING_ERROR = {
    error: "invalid_request",
    error_description: "Already found an entry for username Google_1 "
  };

  it("exchanges the code, sets the session, and returns the user to where they started", async () => {
    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code", state: "oauth-state" })
      .set("Cookie", oauthCookie());

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/cart");
    expect(service.exchangeAuthorizationCode).toHaveBeenCalledWith("auth-code", CALLBACK_URI, "oauth-verifier");
    const cookies = setCookies(res);
    expect(cookies[SessionCookie.Access]).toBeDefined();
    expect(cookies[SessionCookie.Refresh]).toBeDefined();
    expect(isCleared(cookies[SessionCookie.OAuth])).toBe(true);
  });

  it("rejects a mismatched state", async () => {
    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code", state: "forged" })
      .set("Cookie", oauthCookie());

    expect(res.headers.location).toBe("/auth/sign-in?googleError=failed&returnTo=%2Fcart");
    expect(service.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("rejects a callback without the state cookie", async () => {
    const res = await request(app).get("/api/auth/google/callback").query({ code: "auth-code", state: "oauth-state" });

    expect(res.headers.location).toBe("/auth/sign-in?googleError=failed");
    expect(service.exchangeAuthorizationCode).not.toHaveBeenCalled();
  });

  it("reports a cancelled sign-in", async () => {
    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ error: "access_denied" })
      .set("Cookie", oauthCookie());

    expect(res.headers.location).toBe("/auth/sign-in?googleError=cancelled&returnTo=%2Fcart");
  });

  it("retries once when Cognito fails the first sign-in after linking accounts", async () => {
    const res = await request(app).get("/api/auth/google/callback").query(LINKING_ERROR).set("Cookie", oauthCookie());

    expect(res.headers.location).toBe(GOOGLE_URL);
    expect(decodeCookie(setCookies(res)[SessionCookie.OAuth])).toMatchObject({ returnTo: "/cart", retried: true });
  });

  it("gives up when the linking error repeats", async () => {
    const res = await request(app)
      .get("/api/auth/google/callback")
      .query(LINKING_ERROR)
      .set("Cookie", oauthCookie({ retried: true }));

    expect(res.headers.location).toBe("/auth/sign-in?googleError=failed&returnTo=%2Fcart");
  });

  it("does not sign the user in when the code exchange fails", async () => {
    service.exchangeAuthorizationCode.mockRejectedValue(new Error("invalid_grant"));

    const res = await request(app)
      .get("/api/auth/google/callback")
      .query({ code: "auth-code", state: "oauth-state" })
      .set("Cookie", oauthCookie());

    expect(res.headers.location).toBe("/auth/sign-in?googleError=failed&returnTo=%2Fcart");
    expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
  });

  describe("when deleting an account", () => {
    const completeDeletion = () =>
      request(app)
        .get("/api/auth/google/callback")
        .query({ code: "auth-code", state: "oauth-state" })
        .set("Cookie", deletionCookie());

    it("removes saved data, deletes the user, clears the session, and goes home", async () => {
      const res = await completeDeletion();

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/");
      expect(service.deleteUser).toHaveBeenCalledWith(tokens().accessToken);
      expect(customerService.deleteSavedData.mock.invocationCallOrder[0]).toBeLessThan(
        service.deleteUser.mock.invocationCallOrder[0]
      );
      expect(customerService.deleteCustomerRecord).toHaveBeenCalled();
      const cookies = setCookies(res);
      expect(isCleared(cookies[SessionCookie.Access])).toBe(true);
      expect(isCleared(cookies[SessionCookie.Refresh])).toBe(true);
      expect(isCleared(cookies[SessionCookie.OAuth])).toBe(true);
    });

    it("refuses a different Google account", async () => {
      service.exchangeAuthorizationCode.mockResolvedValue(
        tokens({ accessToken: accessToken({ sub: "someone-else" }) })
      );

      const res = await completeDeletion();

      expect(res.headers.location).toBe("/account?googleError=wrongAccount");
      expect(customerService.deleteSavedData).not.toHaveBeenCalled();
      expect(service.deleteUser).not.toHaveBeenCalled();
      expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
    });

    it("sends a cancelled deletion back to the account page", async () => {
      const res = await request(app)
        .get("/api/auth/google/callback")
        .query({ error: "access_denied" })
        .set("Cookie", deletionCookie());

      expect(res.headers.location).toBe("/account?googleError=cancelled");
    });

    it("keeps the account when removing saved data fails", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      customerService.deleteSavedData.mockRejectedValue(new Error("boom"));

      const res = await completeDeletion();

      expect(res.headers.location).toBe("/account?googleError=failed");
      expect(service.deleteUser).not.toHaveBeenCalled();
      expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
    });
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
    expect(res.body).toEqual({
      id: "user-123",
      email: "user@example.com",
      name: "Regular User",
      isAdmin: false,
      signInMethod: "email"
    });
  });

  it("returns a 401 when signed out", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});

const USER_EMAIL = "user@example.com";
const sessionCookies = `${SessionCookie.Access}=current-access; ${SessionCookie.Refresh}=refresh`;
const accessOnly = `${SessionCookie.Access}=current-access`;
const asGoogleUser = asUser({
  id: "user-123",
  email: USER_EMAIL,
  name: "Regular User",
  isAdmin: false,
  signInMethod: "google",
  customerData: {}
});

describe("POST /api/auth/me/sign-out", () => {
  it("signs the user out everywhere and clears cookies", async () => {
    const res = await request(app).post("/api/auth/me/sign-out").set(asRegularUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(204);
    expect(service.signOutEverywhere).toHaveBeenCalledWith("current-access");
    const cookies = setCookies(res);
    expect(isCleared(cookies[SessionCookie.Access])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Refresh])).toBe(true);
  });

  it("keeps the cookies when Cognito rejects the sign-out", async () => {
    service.signOutEverywhere.mockRejectedValue(cognitoError("NotAuthorizedException"));

    const res = await request(app).post("/api/auth/me/sign-out").set(asRegularUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(401);
    expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
  });

  it("requires a user", async () => {
    const res = await request(app).post("/api/auth/me/sign-out");

    expect(res.status).toBe(401);
    expect(service.signOutEverywhere).not.toHaveBeenCalled();
  });
});

describe("PUT /api/auth/me", () => {
  it("updates the name and returns the user from the renewed session", async () => {
    service.refresh.mockResolvedValue(tokens({ accessToken: accessToken({ email: USER_EMAIL, name: "Sheik" }) }));

    const res = await request(app)
      .put("/api/auth/me")
      .set(asRegularUser)
      .set("Cookie", sessionCookies)
      .send({ name: " Sheik " });

    expect(res.status).toBe(200);
    expect(service.updateName).toHaveBeenCalledWith("current-access", "Sheik");
    expect(service.refresh).toHaveBeenCalledWith("refresh");
    expect(res.body).toEqual({ ...signedInUser, email: USER_EMAIL, name: "Sheik" });
    expect(setCookies(res)[SessionCookie.Access]).toBeDefined();
  });

  it("returns the updated user without renewing when there is no refresh cookie", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set(asRegularUser)
      .set("Cookie", accessOnly)
      .send({ name: "Sheik" });

    expect(res.status).toBe(200);
    expect(service.refresh).not.toHaveBeenCalled();
    expect(res.body).toEqual({ ...signedInUser, email: USER_EMAIL, name: "Sheik" });
  });

  it("still succeeds when renewing the session fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    service.refresh.mockRejectedValue(new Error("boom"));

    const res = await request(app)
      .put("/api/auth/me")
      .set(asRegularUser)
      .set("Cookie", sessionCookies)
      .send({ name: "Sheik" });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Sheik");
    expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
  });

  it("rejects a blank name", async () => {
    const res = await request(app)
      .put("/api/auth/me")
      .set(asRegularUser)
      .set("Cookie", sessionCookies)
      .send({ name: " " });

    expect(res.status).toBe(400);
    expect(service.updateName).not.toHaveBeenCalled();
  });

  it("requires a user", async () => {
    const res = await request(app).put("/api/auth/me").send({ name: "Sheik" });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/me/email", () => {
  const requestChange = (email: string, user = asRegularUser) =>
    request(app).post("/api/auth/me/email").set(user).set("Cookie", sessionCookies).send({ email });

  it("asks Cognito to send a code to the new email", async () => {
    const res = await requestChange("sheik@hyrule.com");

    expect(res.status).toBe(202);
    expect(service.requestEmailChange).toHaveBeenCalledWith("current-access", "sheik@hyrule.com");
  });

  it("rejects the user's current email", async () => {
    const res = await requestChange("USER@example.com");

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("That's already your email.");
    expect(service.requestEmailChange).not.toHaveBeenCalled();
  });

  it("forbids Google users from changing their email", async () => {
    const res = await requestChange("sheik@hyrule.com", asGoogleUser);

    expect(res.status).toBe(403);
    expect(service.requestEmailChange).not.toHaveBeenCalled();
  });

  it("returns a 409 when another account uses the email", async () => {
    service.requestEmailChange.mockRejectedValue(cognitoError("AliasExistsException"));

    const res = await requestChange("sheik@hyrule.com");

    expect(res.status).toBe(409);
    expect(res.body.code).toBe(ErrorCode.AccountExists);
  });
});

describe("POST /api/auth/me/email/confirm", () => {
  const confirmChange = (user = asRegularUser) =>
    request(app).post("/api/auth/me/email/confirm").set(user).set("Cookie", sessionCookies).send({ code: "123456" });

  it("confirms the code and returns the user from the renewed session", async () => {
    service.refresh.mockResolvedValue(tokens({ accessToken: accessToken({ email: "sheik@hyrule.com" }) }));

    const res = await confirmChange();

    expect(res.status).toBe(200);
    expect(service.confirmEmailChange).toHaveBeenCalledWith("current-access", "123456");
    expect(res.body.email).toBe("sheik@hyrule.com");
  });

  it("returns the invalid code error", async () => {
    service.confirmEmailChange.mockRejectedValue(cognitoError("CodeMismatchException"));

    const res = await confirmChange();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.InvalidCode);
    expect(service.refresh).not.toHaveBeenCalled();
  });

  it("forbids Google users", async () => {
    const res = await confirmChange(asGoogleUser);

    expect(res.status).toBe(403);
    expect(service.confirmEmailChange).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/me/deletion/google", () => {
  it("sends a Google user to Google and remembers who is deleting", async () => {
    const res = await request(app).get("/api/auth/me/deletion/google").set(asGoogleUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(GOOGLE_URL);
    expect(decodeCookie(setCookies(res)[SessionCookie.OAuth])).toMatchObject({
      purpose: "deleteAccount",
      returnTo: "/",
      userId: "user-123"
    });
  });

  it("refuses email users", async () => {
    const res = await request(app).get("/api/auth/me/deletion/google").set(asRegularUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(403);
    expect(service.googleSignInUrl).not.toHaveBeenCalled();
  });

  it("requires a user", async () => {
    const res = await request(app).get("/api/auth/me/deletion/google");

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/me/deletion", () => {
  it("emails a code to the user and stores the pending session", async () => {
    service.startSignIn.mockResolvedValue({ email: USER_EMAIL, session: "delete-session" });

    const res = await request(app).post("/api/auth/me/deletion").set(asRegularUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(202);
    expect(service.startSignIn).toHaveBeenCalledWith(USER_EMAIL);
    expect(setCookies(res)[SessionCookie.Pending]).toContain(encode({ email: USER_EMAIL, session: "delete-session" }));
  });

  it("requires a user", async () => {
    const res = await request(app).post("/api/auth/me/deletion");

    expect(res.status).toBe(401);
    expect(service.startSignIn).not.toHaveBeenCalled();
  });

  it("refuses Google users", async () => {
    const res = await request(app).post("/api/auth/me/deletion").set(asGoogleUser).set("Cookie", sessionCookies);

    expect(res.status).toBe(403);
    expect(service.startSignIn).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/me/deletion/confirm", () => {
  const confirmDeletion = (cookie = `${sessionCookies}; ${pendingCookie(USER_EMAIL)}`) =>
    request(app)
      .post("/api/auth/me/deletion/confirm")
      .set(asRegularUser)
      .set("Cookie", cookie)
      .send({ code: "123456" });

  it("verifies the code, removes saved data, deletes the user, and clears the session", async () => {
    service.verifySignIn.mockResolvedValue(tokens({ accessToken: "fresh-access" }));

    const res = await confirmDeletion();

    expect(res.status).toBe(204);
    expect(service.verifySignIn).toHaveBeenCalledWith({ email: USER_EMAIL, session: "pending-session" }, "123456");
    expect(service.deleteUser).toHaveBeenCalledWith("fresh-access");
    expect(customerService.deleteSavedData.mock.invocationCallOrder[0]).toBeLessThan(
      service.deleteUser.mock.invocationCallOrder[0]
    );
    expect(service.deleteUser.mock.invocationCallOrder[0]).toBeLessThan(
      customerService.deleteCustomerRecord.mock.invocationCallOrder[0]
    );
    const cookies = setCookies(res);
    expect(isCleared(cookies[SessionCookie.Access])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Refresh])).toBe(true);
    expect(isCleared(cookies[SessionCookie.Pending])).toBe(true);
  });

  it.each([
    ["there is no pending deletion", sessionCookies],
    ["the pending code was for another email", `${sessionCookies}; ${pendingCookie("other@example.com")}`]
  ])("returns a 401 when %s", async (_, cookie) => {
    const res = await confirmDeletion(cookie);

    expect(res.status).toBe(401);
    expect(res.body.code).toBe(ErrorCode.NoPendingSignIn);
    expect(service.verifySignIn).not.toHaveBeenCalled();
    expect(customerService.deleteSavedData).not.toHaveBeenCalled();
  });

  it("keeps the pending session and deletes nothing when the code is wrong", async () => {
    service.verifySignIn.mockRejectedValue(cognitoError("CodeMismatchException"));

    const res = await confirmDeletion();

    expect(res.status).toBe(400);
    expect(res.body.code).toBe(ErrorCode.InvalidCode);
    expect(setCookies(res)[SessionCookie.Pending]).toBeUndefined();
    expect(customerService.deleteSavedData).not.toHaveBeenCalled();
    expect(service.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the account when removing saved data fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    customerService.deleteSavedData.mockRejectedValue(new Error("boom"));

    const res = await confirmDeletion();

    expect(res.status).toBe(500);
    expect(service.deleteUser).not.toHaveBeenCalled();
    expect(setCookies(res)[SessionCookie.Access]).toBeUndefined();
  });

  it("still succeeds when removing the customer record fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    customerService.deleteCustomerRecord.mockRejectedValue(new Error("boom"));

    const res = await confirmDeletion();

    expect(res.status).toBe(204);
    expect(isCleared(setCookies(res)[SessionCookie.Access])).toBe(true);
  });
});
