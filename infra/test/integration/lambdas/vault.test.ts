import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { VaultCard } from "@mm/lib/lambdas";

import { handler as tokenize } from "../../../src/lambdas/vaultCardTokenizer";
import { handler as deleteCard } from "../../../src/lambdas/vaultDeleteCard";
import { handler as describeCard } from "../../../src/lambdas/vaultDescribeCard";
import { handler as updateCard } from "../../../src/lambdas/vaultUpdateCardExpiration";
import { invoke } from "../../helpers/lambda";

const { VAULT_CARD_TABLE_NAME } = process.env;
const db = dbClient();
const kms = new KMSClient({});

const cardData = {
  brand: "visa",
  cardNumber: "4111111111114242",
  expirationMonth: 4,
  expirationYear: 2030
};
const metadata = { brand: "visa", expirationMonth: 4, expirationYear: 2030, lastFour: "4242" };

let customerId: string;

const getRawCard = async (token: string) =>
  (await db.send(new GetCommand({ TableName: VAULT_CARD_TABLE_NAME, Key: { token } }))).Item as VaultCard | undefined;

const putCard = async (overrides: Partial<VaultCard> = {}) => {
  const card: VaultCard = {
    token: crypto.randomUUID(),
    customerId,
    cypher: new Uint8Array([1, 2, 3]),
    ...metadata,
    ...overrides
  };
  await db.send(new PutCommand({ TableName: VAULT_CARD_TABLE_NAME, Item: card }));
  return card;
};

const tokenizeCard = async () => {
  const result = (await invoke(tokenize, {
    body: JSON.stringify(cardData),
    requestContext: { authorizer: { lambda: { customerId } } }
  })) as { statusCode: number; body: string };
  return { statusCode: result.statusCode, token: JSON.parse(result.body).token as string };
};

beforeEach(() => {
  customerId = crypto.randomUUID();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("vaultCardTokenizer", () => {
  it("stores the encrypted card under the returned token", async () => {
    const { statusCode, token } = await tokenizeCard();

    expect(statusCode).toBe(201);
    expect(await getRawCard(token)).toEqual({
      token,
      customerId,
      cypher: expect.any(Uint8Array),
      ...metadata
    });
  });

  it("encrypts the card number so it only decrypts with its own token as context", async () => {
    const { token } = await tokenizeCard();
    const { cypher } = (await getRawCard(token))!;

    const { Plaintext } = await kms.send(
      new DecryptCommand({ CiphertextBlob: cypher, EncryptionContext: { token } })
    );
    expect(Buffer.from(Plaintext!).toString()).toBe(cardData.cardNumber);

    await expect(
      kms.send(new DecryptCommand({ CiphertextBlob: cypher, EncryptionContext: { token: "other-token" } }))
    ).rejects.toThrow(expect.objectContaining({ name: "InvalidCiphertextException" }));
  });

  it("can be described by the owner after tokenizing", async () => {
    const { token } = await tokenizeCard();

    await expect(invoke(describeCard, { token, customerId })).resolves.toEqual(metadata);
  });
});

describe("vaultDescribeCard", () => {
  it("returns the metadata to the owner", async () => {
    const { token } = await putCard();

    await expect(invoke(describeCard, { token, customerId })).resolves.toEqual(metadata);
  });

  it("returns null to another customer", async () => {
    const { token } = await putCard();

    await expect(invoke(describeCard, { token, customerId: crypto.randomUUID() })).resolves.toBeNull();
  });

  it("returns null for an unknown token", async () => {
    await expect(invoke(describeCard, { token: crypto.randomUUID(), customerId })).resolves.toBeNull();
  });
});

describe("vaultUpdateCardExpiration", () => {
  const expiration = { expirationMonth: 11, expirationYear: 2033 };

  it("updates only the expiration for the owner", async () => {
    const card = await putCard();

    await expect(invoke(updateCard, { token: card.token, customerId, ...expiration })).resolves.toBeNull();
    expect(await getRawCard(card.token)).toEqual({ ...card, ...expiration });
  });

  it("refuses to update another customer's card", async () => {
    const card = await putCard();

    await expect(
      invoke(updateCard, { token: card.token, customerId: crypto.randomUUID(), ...expiration })
    ).resolves.toEqual({ errorName: "ConditionalCheckFailedException" });
    expect(await getRawCard(card.token)).toEqual(card);
  });

  it("does not create a card for an unknown token", async () => {
    const token = crypto.randomUUID();

    await expect(invoke(updateCard, { token, customerId, ...expiration })).resolves.toEqual({
      errorName: "ConditionalCheckFailedException"
    });
    expect(await getRawCard(token)).toBeUndefined();
  });
});

describe("vaultDeleteCard", () => {
  it("deletes the owner's card", async () => {
    const { token } = await putCard();

    await expect(invoke(deleteCard, { token, customerId })).resolves.toBeNull();
    expect(await getRawCard(token)).toBeUndefined();
  });

  it("refuses to delete another customer's card", async () => {
    const card = await putCard();

    await expect(invoke(deleteCard, { token: card.token, customerId: crypto.randomUUID() })).resolves.toEqual({
      errorName: "ConditionalCheckFailedException"
    });
    expect(await getRawCard(card.token)).toEqual(card);
  });

  it("reports a condition failure for an unknown token", async () => {
    await expect(invoke(deleteCard, { token: crypto.randomUUID(), customerId })).resolves.toEqual({
      errorName: "ConditionalCheckFailedException"
    });
  });
});
