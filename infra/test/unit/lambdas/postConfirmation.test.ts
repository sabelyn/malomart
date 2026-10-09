import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { PostConfirmationTriggerEvent } from "aws-lambda";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/postConfirmation";
import { invoke } from "../../helpers/lambda";

const cognito = mockClient(CognitoIdentityProviderClient);
const db = mockClient(dbClient());

const sub = crypto.randomUUID();

const makeEvent = (triggerSource: PostConfirmationTriggerEvent["triggerSource"]) =>
  ({
    triggerSource,
    userPoolId: "us-east-1_TestPool",
    userName: "link",
    request: { userAttributes: { sub } }
  }) as unknown as PostConfirmationTriggerEvent;

beforeEach(() => {
  cognito.reset();
  db.reset();
  cognito.on(AdminAddUserToGroupCommand).resolves({});
  db.on(PutCommand).resolves({});
});

describe("on sign-up confirmation", () => {
  it("adds the user to the customer group", async () => {
    await invoke(handler, makeEvent("PostConfirmation_ConfirmSignUp"));

    expect(cognito).toHaveReceivedCommandWith(AdminAddUserToGroupCommand, {
      UserPoolId: "us-east-1_TestPool",
      Username: "link",
      GroupName: "customers"
    });
  });

  it("creates a customer record keyed by the user's sub", async () => {
    await invoke(handler, makeEvent("PostConfirmation_ConfirmSignUp"));

    expect(db).toHaveReceivedCommandWith(PutCommand, { TableName: "customers", Item: { id: sub } });
  });

  it("returns the event", async () => {
    const event = makeEvent("PostConfirmation_ConfirmSignUp");

    await expect(invoke(handler, event)).resolves.toBe(event);
  });

  it("fails the trigger when either call fails", async () => {
    db.on(PutCommand).rejects(new Error("boom"));

    await expect(invoke(handler, makeEvent("PostConfirmation_ConfirmSignUp"))).rejects.toThrow("boom");
  });
});

it("ignores forgot-password confirmations", async () => {
  const event = makeEvent("PostConfirmation_ConfirmForgotPassword");

  await expect(invoke(handler, event)).resolves.toBe(event);
  expect(cognito).not.toHaveReceivedAnyCommand();
  expect(db).not.toHaveReceivedAnyCommand();
});
