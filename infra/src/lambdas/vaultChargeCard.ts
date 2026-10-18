import { DecryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { isCardExpired } from "@mm/lib/customers";
import type { ChargeCardResult, InvokeErrorResponse, VaultCard } from "@mm/lib/lambdas";
import { ChargeCardEvent, DeclineReason } from "@mm/lib/lambdas";
import type { Handler } from "aws-lambda";

import { toInvokeError } from "./helpers";

const { VAULT_CARD_TABLE_NAME, VAULT_KEY_ID } = process.env;
const kmsClient = new KMSClient({});

export const DECLINING_TEST_CARDS = new Set(["4000000000000002", "4000000000009995"]);

const declined = (reason: DeclineReason): ChargeCardResult => ({ approved: false, reason });

export const handler: Handler<ChargeCardEvent, ChargeCardResult | InvokeErrorResponse> = async event => {
  try {
    const { token, customerId } = ChargeCardEvent.parse(event);
    const result = await dbClient().send(
      new GetCommand({
        TableName: VAULT_CARD_TABLE_NAME!,
        Key: { token }
      })
    );
    const card = result.Item as VaultCard | undefined;
    if (!card || card.customerId !== customerId) {
      return declined(DeclineReason.Declined);
    }
    if (isCardExpired(card)) {
      return declined(DeclineReason.Expired);
    }

    const { Plaintext } = await kmsClient.send(
      new DecryptCommand({
        KeyId: VAULT_KEY_ID,
        CiphertextBlob: card.cypher,
        EncryptionContext: { token }
      })
    );
    if (DECLINING_TEST_CARDS.has(Buffer.from(Plaintext!).toString())) {
      return declined(DeclineReason.Declined);
    }

    return { approved: true, chargeId: crypto.randomUUID() };
  } catch (err) {
    return toInvokeError(err);
  }
};
