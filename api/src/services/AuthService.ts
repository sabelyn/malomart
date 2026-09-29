import type { AuthenticationResultType, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import {
  ConfirmSignUpCommand,
  DescribeUserPoolClientCommand,
  GetTokensFromRefreshTokenCommand,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  RevokeTokenCommand,
  SignUpCommand
} from "@aws-sdk/client-cognito-identity-provider";
import { createHmac } from "node:crypto";
import { inject, injectable } from "tsyringe";

import type { AuthTokens, IAuthService, PendingAuth } from "@/contracts";
import { COGNITO } from "@/contracts/tokens";
import env from "@/env";
import { internal } from "@/errors/helpers";

const ClientId = env.USER_POOL_CLIENT_ID;

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

  constructor(@inject(COGNITO) private readonly cognito: CognitoIdentityProviderClient) { }

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
