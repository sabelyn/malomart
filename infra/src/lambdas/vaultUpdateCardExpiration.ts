import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { InvokeErrorResponse } from "@mm/lib/lambdas";
import { UpdatePaymentMethodExpirationEvent } from "@mm/lib/lambdas";
import type { Handler } from "aws-lambda";

import { isRetriableError } from "./helpers";

const { VAULT_CARD_TABLE_NAME } = process.env;

export const handler: Handler<UpdatePaymentMethodExpirationEvent, InvokeErrorResponse | null> = async event => {
  try {
    const { expirationMonth, expirationYear, token, customerId } = UpdatePaymentMethodExpirationEvent.parse(event);
    await dbClient().send(
      new UpdateCommand({
        TableName: VAULT_CARD_TABLE_NAME!,
        Key: { token },
        ConditionExpression: "attribute_exists(token) AND customerId = :customerId",
        UpdateExpression: "SET expirationMonth = :month, expirationYear = :year",
        ExpressionAttributeValues: {
          ":month": expirationMonth,
          ":year": expirationYear,
          ":customerId": customerId
        }
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
