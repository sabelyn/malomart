import type {
  AuthenticationResultType,
  CognitoIdentityProviderClient
} from "@aws-sdk/client-cognito-identity-provider";
import {
  ConfirmSignUpCommand,
  DeleteUserCommand,
  DescribeUserPoolClientCommand,
  GetTokensFromRefreshTokenCommand,
  GlobalSignOutCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
  SignUpCommand,
  UpdateUserAttributesCommand,
  VerifyUserAttributeCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "node:crypto";
import { inject, injectable } from "tsyringe";
import { number, object, string } from "zod";

import type { AuthTokens, IAuthService, PendingAuth } from "@/contracts";
import { COGNITO } from "@/contracts/tokens";
import env from "@/env";
import { internal, unauthorized } from "@/errors/helpers";

const ClientId = env.USER_POOL_CLIENT_ID;
const OAUTH_SCOPES = "openid email profile aws.cognito.signin.user.admin";

const TokenResponse = object({
  access_token: string(),
  expires_in: number(),
  refresh_token: string().optional()
});

const toTokens = (result: AuthenticationResultType | undefined): AuthTokens => {
  if (!result?.AccessToken || !result.ExpiresIn) {
    throw internal(new Error("Cognito did not return an access token."));
  }
  return {
    accessToken: result.AccessToken,
    expiresIn: result.ExpiresIn,
    refreshToken: result.RefreshToken
  };
};

@injectable()
export class AuthService implements IAuthService {
  private clientSecret?: Promise<string>;

  constructor(@inject(COGNITO) private readonly cognito: CognitoIdentityProviderClient) {}

  signUp = async (email: string, name: string) => {
    const { Session } = await this.cognito.send(
      new SignUpCommand({
        ClientId,
        SecretHash: await this.secretHash(email),
        Username: email,
        UserAttributes: [
          { Name: "email", Value: email },
          { Name: "name", Value: name }
        ]
      })
    );
    return Session ? { email, session: Session } : undefined;
  };

  confirmSignUp = async (email: string, code: string, session?: string) => {
    const secretHash = await this.secretHash(email);
    const { Session } = await this.cognito.send(
      new ConfirmSignUpCommand({
        ClientId,
        SecretHash: secretHash,
        Username: email,
        ConfirmationCode: code,
        Session: session
      })
    );
    if (!Session) {
      return undefined;
    }

    try {
      const { AuthenticationResult } = await this.cognito.send(
        new InitiateAuthCommand({
          ClientId,
          AuthFlow: "USER_AUTH",
          AuthParameters: { USERNAME: email, SECRET_HASH: secretHash },
          Session
        })
      );
      return AuthenticationResult ? toTokens(AuthenticationResult) : undefined;
    } catch (err) {
      console.warn("Automatic sign-in after sign-up confirmation failed.", err);
      return undefined;
    }
  };

  startSignIn = async (email: string) => {
    const { ChallengeName, Session } = await this.cognito.send(
      new InitiateAuthCommand({
        ClientId,
        AuthFlow: "USER_AUTH",
        AuthParameters: {
          USERNAME: email,
          PREFERRED_CHALLENGE: "EMAIL_OTP",
          SECRET_HASH: await this.secretHash(email)
        }
      })
    );
    if (ChallengeName !== "EMAIL_OTP" || !Session) {
      throw internal(new Error(`Unexpected sign-in challenge: ${ChallengeName ?? "none"}.`));
    }
    return { email, session: Session };
  };

  verifySignIn = async ({ email, session }: PendingAuth, code: string) => {
    const { AuthenticationResult } = await this.cognito.send(
      new RespondToAuthChallengeCommand({
        ClientId,
        ChallengeName: "EMAIL_OTP",
        Session: session,
        ChallengeResponses: {
          USERNAME: email,
          EMAIL_OTP_CODE: code,
          SECRET_HASH: await this.secretHash(email)
        }
      })
    );
    return toTokens(AuthenticationResult);
  };

  refresh = async (refreshToken: string) => {
    const { AuthenticationResult } = await this.cognito.send(
      new GetTokensFromRefreshTokenCommand({
        ClientId,
        ClientSecret: await this.getClientSecret(),
        RefreshToken: refreshToken
      })
    );
    return toTokens(AuthenticationResult);
  };

  signOut = async (refreshToken: string) => {
    await this.cognito.send(
      new RevokeTokenCommand({
        ClientId,
        ClientSecret: await this.getClientSecret(),
        Token: refreshToken
      })
    );
  };

  signOutEverywhere = async (accessToken: string) => {
    await this.cognito.send(new GlobalSignOutCommand({ AccessToken: accessToken }));
  };

  updateName = async (accessToken: string, name: string) => {
    await this.cognito.send(
      new UpdateUserAttributesCommand({ AccessToken: accessToken, UserAttributes: [{ Name: "name", Value: name }] })
    );
  };

  requestEmailChange = async (accessToken: string, email: string) => {
    await this.cognito.send(
      new UpdateUserAttributesCommand({ AccessToken: accessToken, UserAttributes: [{ Name: "email", Value: email }] })
    );
  };

  confirmEmailChange = async (accessToken: string, code: string) => {
    await this.cognito.send(
      new VerifyUserAttributeCommand({ AccessToken: accessToken, AttributeName: "email", Code: code })
    );
  };

  deleteUser = async (accessToken: string) => {
    await this.cognito.send(new DeleteUserCommand({ AccessToken: accessToken }));
  };

  googleSignInUrl = (redirectUri: string, state: string, codeChallenge: string) => {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: ClientId,
      redirect_uri: redirectUri,
      identity_provider: "Google",
      scope: OAUTH_SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256"
    });
    return `${this.oauthDomain()}/oauth2/authorize?${params.toString()}`;
  };

  exchangeAuthorizationCode = async (code: string, redirectUri: string, codeVerifier: string) => {
    const credentials = Buffer.from(`${ClientId}:${await this.getClientSecret()}`).toString("base64");
    const response = await fetch(`${this.oauthDomain()}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Authorization: `Basic ${credentials}` },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: ClientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier
      })
    });
    if (!response.ok) {
      throw unauthorized(
        new Error(`Cognito rejected the authorization code (${response.status}): ${await response.text()}`)
      );
    }

    const result = TokenResponse.safeParse(await response.json());
    if (!result.success) {
      throw internal(result.error);
    }
    return {
      accessToken: result.data.access_token,
      expiresIn: result.data.expires_in,
      refreshToken: result.data.refresh_token
    };
  };

  private oauthDomain = () => {
    if (!env.OAUTH_DOMAIN) {
      throw internal(new Error("OAUTH_DOMAIN is not configured."));
    }
    return env.OAUTH_DOMAIN;
  };

  private secretHash = async (username: string) =>
    createHmac("sha256", await this.getClientSecret())
      .update(username + ClientId)
      .digest("base64");

  private getClientSecret = () => {
    this.clientSecret ??= this.cognito
      .send(new DescribeUserPoolClientCommand({ UserPoolId: env.USER_POOL_ID, ClientId }))
      .then(({ UserPoolClient }) => {
        if (!UserPoolClient?.ClientSecret) {
          throw internal(new Error("The user pool client has no secret."));
        }
        return UserPoolClient.ClientSecret;
      });
    this.clientSecret.catch(() => {
      this.clientSecret = undefined;
    });
    return this.clientSecret;
  };
}
