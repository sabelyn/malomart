import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/vaultUpdateCardExpiration";
import { awsError, invoke } from "../../helpers/lambda";

const db = mockClient(dbClient());

const event = { token: "card-token", customerId: crypto.randomUUID(), expirationMonth: 11, expirationYear: 2031 };

beforeEach(() => {
  db.reset();
  db.on(UpdateCommand).resolves({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("updates the expiration only on an existing card owned by the customer", async () => {
  await expect(invoke(handler, event)).resolves.toBeNull();

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: "vault-cards",
    Key: { token: event.token },
    ConditionExpression: "attribute_exists(#token) AND customerId = :customerId",
    ExpressionAttributeNames: { "#token": "token" },
    UpdateExpression: "SET expirationMonth = :month, expirationYear = :year",
    ExpressionAttributeValues: {
      ":month": event.expirationMonth,
      ":year": event.expirationYear,
      ":customerId": event.customerId
    }
  });
});

it("returns the error name when the condition fails", async () => {
  db.on(UpdateCommand).rejects(awsError("ConditionalCheckFailedException"));

  await expect(invoke(handler, event)).resolves.toEqual({ errorName: "ConditionalCheckFailedException" });
});

it("returns the error name for an invalid event without touching the table", async () => {
  await expect(invoke(handler, { ...event, expirationMonth: 12 })).resolves.toEqual({ errorName: "ZodError" });
  expect(db).not.toHaveReceivedAnyCommand();
});

it.each(["ThrottlingException", "RequestLimitExceeded", "InternalServerError"])(
  "rethrows %s so the invocation can be retried",
  async name => {
    db.on(UpdateCommand).rejects(awsError(name));

    await expect(invoke(handler, event)).rejects.toThrow(name);
  }
);
