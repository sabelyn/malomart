import {
  CognitoIdentityProviderClient,
  ConfirmSignUpCommand,
  DescribeUserPoolClientCommand,
  GetTokensFromRefreshTokenCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
  SignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { mockClient } from "aws-sdk-client-mock";
import { createHmac } from "node:crypto";

import { ApiError } from "@/errors/ApiError";
import { AuthService } from "@/services";

const CLIENT_ID = "test-client-id";
const CLIENT_SECRET = "test-client-secret";
const EMAIL = "link@hyrule.com";

const secretHash = (username: string) =>
  createHmac("sha256", CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest("base64");

const authResult = { AccessToken: "access", ExpiresIn: 900, RefreshToken: "refresh" };
const tokens = { accessToken: "access", expiresIn: 900, refreshToken: "refresh" };

const cognito = mockClient(CognitoIdentityProviderClient);
let service: AuthService;

beforeEach(() => {
  cognito.reset();
  cognito.on(DescribeUserPoolClientCommand).resolves({ UserPoolClient: { ClientSecret: CLIENT_SECRET } });
  service = new AuthService(new CognitoIdentityProviderClient({}));
});

describe("client secret", () => {
  it("is fetched once and reused", async () => {
    cognito.on(InitiateAuthCommand).resolves({ ChallengeName: "EMAIL_OTP", Session: "session" });

    await service.startSignIn(EMAIL);
    await service.startSignIn(EMAIL);

    expect(cognito).toHaveReceivedCommandTimes(DescribeUserPoolClientCommand, 1);
    expect(cognito).toHaveReceivedCommandWith(DescribeUserPoolClientCommand, {
      UserPoolId: "us-east-1_TestPool",
      ClientId: CLIENT_ID
    });
  });

  it("is fetched again after a failure", async () => {
    cognito
      .on(DescribeUserPoolClientCommand)
      .rejectsOnce(new Error("throttled"))
      .resolves({ UserPoolClient: { ClientSecret: CLIENT_SECRET } });
    cognito.on(InitiateAuthCommand).resolves({ ChallengeName: "EMAIL_OTP", Session: "session" });

    await expect(service.startSignIn(EMAIL)).rejects.toThrow("throttled");
    await expect(service.startSignIn(EMAIL)).resolves.toEqual({ email: EMAIL, session: "session" });
  });

  it("fails when the client has no secret", async () => {
    cognito.on(DescribeUserPoolClientCommand).resolves({ UserPoolClient: {} });

    await expect(service.startSignIn(EMAIL)).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("signUp", () => {
  it("signs up without a password and returns the pending session", async () => {
    cognito.on(SignUpCommand).resolves({ UserConfirmed: false, UserSub: "sub", Session: "signup-session" });

    await expect(service.signUp(EMAIL, "Link")).resolves.toEqual({ email: EMAIL, session: "signup-session" });
    expect(cognito).toHaveReceivedCommandWith(SignUpCommand, {
      ClientId: CLIENT_ID,
      SecretHash: secretHash(EMAIL),
      Username: EMAIL,
      UserAttributes: [
        { Name: "email", Value: EMAIL },
        { Name: "name", Value: "Link" }
      ]
    });
    expect(cognito.commandCalls(SignUpCommand)[0].args[0].input.Password).toBeUndefined();
  });

  it("returns nothing when Cognito gives no session", async () => {
    cognito.on(SignUpCommand).resolves({ UserConfirmed: false, UserSub: "sub" });

    await expect(service.signUp(EMAIL, "Link")).resolves.toBeUndefined();
  });
});

describe("confirmSignUp", () => {
  it("confirms and signs in with the returned session", async () => {
    cognito.on(ConfirmSignUpCommand).resolves({ Session: "confirm-session" });
    cognito.on(InitiateAuthCommand).resolves({ AuthenticationResult: authResult });

    await expect(service.confirmSignUp(EMAIL, "123456", "signup-session")).resolves.toEqual(tokens);
    expect(cognito).toHaveReceivedCommandWith(ConfirmSignUpCommand, {
      ClientId: CLIENT_ID,
      SecretHash: secretHash(EMAIL),
      Username: EMAIL,
      ConfirmationCode: "123456",
      Session: "signup-session"
    });
    expect(cognito).toHaveReceivedCommandWith(InitiateAuthCommand, {
      ClientId: CLIENT_ID,
      AuthFlow: "USER_AUTH",
      AuthParameters: { USERNAME: EMAIL, SECRET_HASH: secretHash(EMAIL) },
      Session: "confirm-session"
    });
  });

  it("returns nothing when confirmation gives no session", async () => {
    cognito.on(ConfirmSignUpCommand).resolves({});

    await expect(service.confirmSignUp(EMAIL, "123456")).resolves.toBeUndefined();
    expect(cognito).not.toHaveReceivedCommand(InitiateAuthCommand);
  });

  it("returns nothing when the automatic sign-in fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    cognito.on(ConfirmSignUpCommand).resolves({ Session: "confirm-session" });
    cognito.on(InitiateAuthCommand).rejects(new Error("session expired"));

    await expect(service.confirmSignUp(EMAIL, "123456", "signup-session")).resolves.toBeUndefined();
  });

  it("propagates confirmation failures", async () => {
    cognito.on(ConfirmSignUpCommand).rejects(new Error("bad code"));

    await expect(service.confirmSignUp(EMAIL, "123456")).rejects.toThrow("bad code");
  });
});

describe("startSignIn", () => {
  it("starts an email OTP sign-in", async () => {
    cognito.on(InitiateAuthCommand).resolves({ ChallengeName: "EMAIL_OTP", Session: "session" });

    await expect(service.startSignIn(EMAIL)).resolves.toEqual({ email: EMAIL, session: "session" });
    expect(cognito).toHaveReceivedCommandWith(InitiateAuthCommand, {
      ClientId: CLIENT_ID,
      AuthFlow: "USER_AUTH",
      AuthParameters: { USERNAME: EMAIL, PREFERRED_CHALLENGE: "EMAIL_OTP", SECRET_HASH: secretHash(EMAIL) }
    });
  });

  it.each([
    ["a different challenge", { ChallengeName: "SELECT_CHALLENGE" as const, Session: "session" }],
    ["no session", { ChallengeName: "EMAIL_OTP" as const }]
  ])("fails on %s", async (_, response) => {
    cognito.on(InitiateAuthCommand).resolves(response);

    await expect(service.startSignIn(EMAIL)).rejects.toBeInstanceOf(ApiError);
  });
});

describe("verifySignIn", () => {
  it("answers the email OTP challenge and returns the tokens", async () => {
    cognito.on(RespondToAuthChallengeCommand).resolves({ AuthenticationResult: authResult });

    await expect(service.verifySignIn({ email: EMAIL, session: "session" }, "12345678")).resolves.toEqual(tokens);
    expect(cognito).toHaveReceivedCommandWith(RespondToAuthChallengeCommand, {
      ClientId: CLIENT_ID,
      ChallengeName: "EMAIL_OTP",
      Session: "session",
      ChallengeResponses: { USERNAME: EMAIL, EMAIL_OTP_CODE: "12345678", SECRET_HASH: secretHash(EMAIL) }
    });
  });

  it("fails when Cognito returns no tokens", async () => {
    cognito.on(RespondToAuthChallengeCommand).resolves({ ChallengeName: "EMAIL_OTP", Session: "again" });

    await expect(service.verifySignIn({ email: EMAIL, session: "session" }, "12345678")).rejects.toMatchObject({
      statusCode: 500
    });
  });
});

describe("refresh", () => {
  it("exchanges the refresh token using the client secret", async () => {
    cognito.on(GetTokensFromRefreshTokenCommand).resolves({ AuthenticationResult: authResult });

    await expect(service.refresh("old-refresh")).resolves.toEqual(tokens);
    expect(cognito).toHaveReceivedCommandWith(GetTokensFromRefreshTokenCommand, {
      ClientId: CLIENT_ID,
      ClientSecret: CLIENT_SECRET,
      RefreshToken: "old-refresh"
    });
  });
});

describe("signOut", () => {
  it("revokes the refresh token", async () => {
    cognito.on(RevokeTokenCommand).resolves({});

    await service.signOut("refresh");

    expect(cognito).toHaveReceivedCommandWith(RevokeTokenCommand, {
      ClientId: CLIENT_ID,
      ClientSecret: CLIENT_SECRET,
      Token: "refresh"
    });
  });
});
