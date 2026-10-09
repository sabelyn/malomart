import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { InvokeErrorResponse } from "@mm/lib/lambdas";
import { PaymentMethodIdEvent } from "@mm/lib/lambdas";
import type { Handler } from "aws-lambda";

import { isRetriableError } from "./helpers";

const { VAULT_CARD_TABLE_NAME } = process.env;

export const handler: Handler<PaymentMethodIdEvent, InvokeErrorResponse | null> = async event => {
  try {
    const { token, customerId } = PaymentMethodIdEvent.parse(event);
    await dbClient().send(
      new DeleteCommand({
        TableName: VAULT_CARD_TABLE_NAME,
        Key: { token },
        ConditionExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": customerId }
      })
    );
  } catch (err) {
    if (isRetriableError(err)) {
      throw err;
    }

    console.error(err);
    return { errorName: err instanceof Error ? err.name : "Unknown" };
  }
  return null;
};
