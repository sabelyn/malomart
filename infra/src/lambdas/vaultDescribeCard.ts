import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { InvokeErrorResponse, PaymentMethodMetadata, VaultCard } from "@mm/lib/lambdas";
import { PaymentMethodIdEvent } from "@mm/lib/lambdas";
import type { Handler } from "aws-lambda";

import { isRetriableError } from "./helpers";

const { VAULT_CARD_TABLE_NAME } = process.env;

export const handler: Handler<
  PaymentMethodIdEvent,
  PaymentMethodMetadata | InvokeErrorResponse | null
> = async event => {
  try {
    const { token, customerId } = PaymentMethodIdEvent.parse(event);
    const result = await dbClient().send(
      new GetCommand({
        TableName: VAULT_CARD_TABLE_NAME!,
        Key: { token }
      })
    );
    const card = result.Item as VaultCard | null;
    if (card && card.customerId === customerId) {
      return {
        brand: card.brand,
        expirationMonth: card.expirationMonth,
        expirationYear: card.expirationYear,
        lastFour: card.lastFour
      };
    }
  } catch (err) {
    if (isRetriableError(err)) {
      throw err;
    }

    console.error(err);
    return { errorName: err instanceof Error ? err.name : "Unknown" };
  }

  return null;
};
