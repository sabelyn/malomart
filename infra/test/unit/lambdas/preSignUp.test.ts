import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";
import type { PreSignUpTriggerEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/preSignUp";
import { invoke } from "../../helpers/lambda";

const cognito = mockClient(CognitoIdentityProviderClient);

const makeEvent = (
  overrides: { triggerSource?: PreSignUpTriggerEvent["triggerSource"]; userName?: string; emailVerified?: string } = {}
) =>
  ({
    triggerSource: overrides.triggerSource ?? "PreSignUp_ExternalProvider",
    userPoolId: "us-east-1_TestPool",
    userName: overrides.userName ?? "Google_1234567890",
    request: { userAttributes: { email: "link@hyrule.test", email_verified: overrides.emailVerified ?? "true" } },
    response: {}
  }) as unknown as PreSignUpTriggerEvent;

beforeEach(() => {
  cognito.reset();
  cognito.on(ListUsersCommand).resolves({ Users: [{ Username: "native-link", UserStatus: "CONFIRMED" }] });
  cognito.on(AdminLinkProviderForUserCommand).resolves({});
});

it("links a Google sign-in to the existing native user with the same email", async () => {
  await invoke(handler, makeEvent());

  expect(cognito).toHaveReceivedCommandWith(ListUsersCommand, {
    UserPoolId: "us-east-1_TestPool",
    Filter: 'email = "link@hyrule.test"'
  });
  expect(cognito).toHaveReceivedCommandWith(AdminLinkProviderForUserCommand, {
    UserPoolId: "us-east-1_TestPool",
    DestinationUser: { ProviderName: "Cognito", ProviderAttributeValue: "native-link" },
    SourceUser: {
      ProviderName: "Google",
      ProviderAttributeName: "Cognito_Subject",
      ProviderAttributeValue: "1234567890"
    }
  });
});

it("returns the event", async () => {
  const event = makeEvent();

  await expect(invoke(handler, event)).resolves.toBe(event);
});

it("does not link to other federated users", async () => {
  cognito.on(ListUsersCommand).resolves({ Users: [{ Username: "google_999", UserStatus: "EXTERNAL_PROVIDER" }] });

  await invoke(handler, makeEvent());

  expect(cognito).not.toHaveReceivedCommand(AdminLinkProviderForUserCommand);
});

it("lets the sign-up through when no user has the email", async () => {
  cognito.on(ListUsersCommand).resolves({ Users: [] });

  await invoke(handler, makeEvent());

  expect(cognito).not.toHaveReceivedCommand(AdminLinkProviderForUserCommand);
});

it("does not link when Google has not verified the email", async () => {
  await invoke(handler, makeEvent({ emailVerified: "false" }));

  expect(cognito).not.toHaveReceivedCommand(ListUsersCommand);
});

it("ignores native sign-ups", async () => {
  await invoke(handler, makeEvent({ triggerSource: "PreSignUp_SignUp", userName: "link" }));

  expect(cognito).not.toHaveReceivedCommand(ListUsersCommand);
});

it("fails the trigger when linking fails", async () => {
  cognito.on(AdminLinkProviderForUserCommand).rejects(new Error("boom"));

  await expect(invoke(handler, makeEvent())).rejects.toThrow("boom");
});
