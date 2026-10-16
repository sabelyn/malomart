import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { VaultCard } from "@mm/lib/lambdas";
import { mockClient } from "aws-sdk-client-mock";

import { DECLINING_TEST_CARDS, handler } from "../../../src/lambdas/vaultChargeCard";
import { awsError, invoke } from "../../helpers/lambda";

const kms = mockClient(KMSClient);
const db = mockClient(dbClient());

const customerId = crypto.randomUUID();
const card: VaultCard = {
  token: "card-token",
  customerId,
  cypher: new Uint8Array([1, 2, 3]),
  brand: "Hyrulian Express",
  expirationMonth: 4,
  expirationYear: 2030,
  lastFour: "4242"
};
const event = { token: card.token, customerId, orderId: crypto.randomUUID(), amount: 120 };

const decryptsTo = (cardNumber: string) =>
  kms.on(DecryptCommand).resolves({ Plaintext: new Uint8Array(Buffer.from(cardNumber)) });

beforeEach(() => {
  kms.reset();
  db.reset();
  db.on(GetCommand).resolves({ Item: card });
  decryptsTo("4111111111114242");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

it("looks up the card by token", async () => {
  await invoke(handler, event);

  expect(db).toHaveReceivedCommandWith(GetCommand, { TableName: "vault-cards", Key: { token: card.token } });
});

it("decrypts the card number with the vault key and its token as context", async () => {
  await invoke(handler, event);

  expect(kms).toHaveReceivedCommandWith(DecryptCommand, {
    KeyId: "test-key-id",
    CiphertextBlob: card.cypher,
    EncryptionContext: { token: card.token }
  });
});

it("approves a valid card with a new charge ID", async () => {
  const first = await invoke(handler, event);
  const second = await invoke(handler, event);

  expect(first).toEqual({ approved: true, chargeId: expect.any(String) });
  expect(second).toEqual({ approved: true, chargeId: expect.any(String) });
  expect(first).not.toEqual(second);
});

it.each([...DECLINING_TEST_CARDS])("declines test card %s", async cardNumber => {
  decryptsTo(cardNumber);

  await expect(invoke(handler, event)).resolves.toEqual({ approved: false, reason: "Declined" });
});

it("declines a card belonging to another customer without decrypting it", async () => {
  await expect(invoke(handler, { ...event, customerId: crypto.randomUUID() })).resolves.toEqual({
    approved: false,
    reason: "Declined"
  });
  expect(kms).not.toHaveReceivedAnyCommand();
});

it("declines an unknown token", async () => {
  db.on(GetCommand).resolves({});

  await expect(invoke(handler, event)).resolves.toEqual({ approved: false, reason: "Declined" });
});

it("declines an expired card without decrypting it", async () => {
  db.on(GetCommand).resolves({ Item: { ...card, expirationYear: 2020 } });

  await expect(invoke(handler, event)).resolves.toEqual({ approved: false, reason: "Expired" });
  expect(kms).not.toHaveReceivedAnyCommand();
});

it("returns the error name for an invalid event without querying the table", async () => {
  await expect(invoke(handler, { ...event, amount: 0 })).resolves.toEqual({ errorName: "ZodError" });
  expect(db).not.toHaveReceivedAnyCommand();
});

it("returns the error name when decryption fails", async () => {
  kms.on(DecryptCommand).rejects(awsError("InvalidCiphertextException"));

  await expect(invoke(handler, event)).resolves.toEqual({ errorName: "InvalidCiphertextException" });
});

it.each(["ThrottlingException", "KMSInternalException", "DependencyTimeoutException"])(
  "rethrows %s so the charge can be retried",
  async name => {
    kms.on(DecryptCommand).rejects(awsError(name));

    await expect(invoke(handler, event)).rejects.toThrow(name);
  }
);
