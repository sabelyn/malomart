import { EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/vaultCardTokenizer";
import { awsError, invoke } from "../../helpers/lambda";

type Result = { statusCode: number; body: string };

const kms = mockClient(KMSClient);
const db = mockClient(dbClient());

const customerId = crypto.randomUUID();
const cypher = new Uint8Array([1, 2, 3]);
const card = {
  brand: "visa",
  cardNumber: "4111111111114242",
  expirationMonth: 4,
  expirationYear: 2030
};

const tokenize = async (body: unknown = JSON.stringify(card)) => {
  const result = (await invoke(handler, {
    body,
    requestContext: { authorizer: { lambda: { customerId } } }
  })) as Result;
  return { statusCode: result.statusCode, body: JSON.parse(result.body) };
};

beforeEach(() => {
  kms.reset();
  db.reset();
  kms.on(EncryptCommand).resolves({ CiphertextBlob: cypher });
  db.on(PutCommand).resolves({});
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("success", () => {
  it("returns a 201 with a random url-safe token", async () => {
    expect(await tokenize()).toEqual({ statusCode: 201, body: { token: expect.stringMatching(/^[\w-]{43}$/) } });
  });

  it("generates a different token for each request", async () => {
    const first = (await tokenize()).body.token;
    const second = (await tokenize()).body.token;

    expect(first).not.toBe(second);
  });

  it("encrypts the card number with the token as encryption context", async () => {
    const { token } = (await tokenize()).body;

    expect(kms).toHaveReceivedCommandWith(EncryptCommand, {
      KeyId: "test-key-id",
      Plaintext: Buffer.from(card.cardNumber),
      EncryptionContext: { token }
    });
  });

  it("stores the cypher and card metadata without the plain card number", async () => {
    const { token } = (await tokenize()).body;

    expect(db).toHaveReceivedCommandTimes(PutCommand, 1);
    expect(db.commandCalls(PutCommand)[0]!.args[0].input).toEqual({
      TableName: "vault-cards",
      Item: {
        token,
        cypher,
        customerId,
        lastFour: "4242",
        brand: card.brand,
        expirationMonth: card.expirationMonth,
        expirationYear: card.expirationYear
      }
    });
  });
});

describe("errors", () => {
  it.each([
    ["a missing body", null, "Request body was invalid JSON."],
    ["malformed JSON", "{", "Request body was invalid JSON."],
    ["a short card number", JSON.stringify({ ...card, cardNumber: "411111111111424" }), "Invalid card data"],
    ["a formatted card number", JSON.stringify({ ...card, cardNumber: "4111-1111-1111-42" }), "Invalid card data"],
    ["unexpected fields", JSON.stringify({ ...card, cvv: "123" }), "Invalid card data"]
  ])("returns a 400 for %s without touching KMS or the table", async (_, body, message) => {
    expect(await tokenize(body)).toEqual({ statusCode: 400, body: { message } });
    expect(kms).not.toHaveReceivedAnyCommand();
    expect(db).not.toHaveReceivedAnyCommand();
  });

  it.each(["ThrottlingException", "KeyUnavailableException", "KMSInternalException"])(
    "returns a 503 when KMS fails with %s",
    async name => {
      kms.on(EncryptCommand).rejects(awsError(name));

      expect((await tokenize()).statusCode).toBe(503);
      expect(db).not.toHaveReceivedAnyCommand();
    }
  );

  it("returns a 503 when the table is throttled", async () => {
    db.on(PutCommand).rejects(awsError("ProvisionedThroughputExceededException"));

    expect((await tokenize()).statusCode).toBe(503);
  });

  it("returns a generic 500 for unexpected failures and logs them", async () => {
    const err = awsError("AccessDeniedException");
    kms.on(EncryptCommand).rejects(err);

    expect(await tokenize()).toEqual({ statusCode: 500, body: { message: "Internal" } });
    expect(console.error).toHaveBeenCalledWith(err);
  });

  it("does not log client errors", async () => {
    await tokenize("{");

    expect(console.error).not.toHaveBeenCalled();
  });
});
