import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { VaultCard } from "@mm/lib/lambdas";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/vaultDescribeCard";
import { awsError, invoke } from "../../helpers/lambda";

const db = mockClient(dbClient());

const customerId = crypto.randomUUID();
const card: VaultCard = {
  token: "card-token",
  customerId,
  cypher: new Uint8Array([1, 2, 3]),
  brand: "visa",
  expirationMonth: 4,
  expirationYear: 2030,
  lastFour: "4242"
};

beforeEach(() => {
  db.reset();
  db.on(GetCommand).resolves({ Item: card });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("looks up the card by token", async () => {
  await invoke(handler, { token: card.token, customerId });

  expect(db).toHaveReceivedCommandWith(GetCommand, { TableName: "vault-cards", Key: { token: card.token } });
});

it("returns only the card metadata to its owner", async () => {
  await expect(invoke(handler, { token: card.token, customerId })).resolves.toEqual({
    brand: "visa",
    expirationMonth: 4,
    expirationYear: 2030,
    lastFour: "4242"
  });
});

it("returns null for a card belonging to another customer", async () => {
  await expect(invoke(handler, { token: card.token, customerId: crypto.randomUUID() })).resolves.toBeNull();
});

it("returns null for an unknown token", async () => {
  db.on(GetCommand).resolves({});

  await expect(invoke(handler, { token: "missing", customerId })).resolves.toBeNull();
});

it("returns the error name for an invalid event without querying the table", async () => {
  await expect(invoke(handler, { token: card.token, customerId: "not-a-uuid" })).resolves.toEqual({
    errorName: "ZodError"
  });
  expect(db).not.toHaveReceivedAnyCommand();
});

it("returns the error name when the lookup fails", async () => {
  db.on(GetCommand).rejects(awsError("ResourceNotFoundException"));

  await expect(invoke(handler, { token: card.token, customerId })).resolves.toEqual({
    errorName: "ResourceNotFoundException"
  });
});

it.each(["ThrottlingException", "ProvisionedThroughputExceededException", "InternalServerError"])(
  "rethrows %s so the invocation can be retried",
  async name => {
    db.on(GetCommand).rejects(awsError(name));

    await expect(invoke(handler, { token: card.token, customerId })).rejects.toThrow(name);
  }
);
