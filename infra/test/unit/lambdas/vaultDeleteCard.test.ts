import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/vaultDeleteCard";
import { awsError, invoke } from "../../helpers/lambda";

const db = mockClient(dbClient());

const event = { token: "card-token", customerId: crypto.randomUUID() };

beforeEach(() => {
  db.reset();
  db.on(DeleteCommand).resolves({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("deletes the card only if it belongs to the customer", async () => {
  await expect(invoke(handler, event)).resolves.toBeNull();

  expect(db).toHaveReceivedCommandWith(DeleteCommand, {
    TableName: "vault-cards",
    Key: { token: event.token },
    ConditionExpression: "customerId = :customerId",
    ExpressionAttributeValues: { ":customerId": event.customerId }
  });
});

it("returns the error name when the condition fails", async () => {
  db.on(DeleteCommand).rejects(awsError("ConditionalCheckFailedException"));

  await expect(invoke(handler, event)).resolves.toEqual({ errorName: "ConditionalCheckFailedException" });
});

it("returns the error name for an invalid event without touching the table", async () => {
  await expect(invoke(handler, { token: "" })).resolves.toEqual({ errorName: "ZodError" });
  expect(db).not.toHaveReceivedAnyCommand();
});

it.each(["ThrottlingException", "ProvisionedThroughputExceededException", "InternalServerError"])(
  "rethrows %s so the invocation can be retried",
  async name => {
    db.on(DeleteCommand).rejects(awsError(name));

    await expect(invoke(handler, event)).rejects.toThrow(name);
  }
);
