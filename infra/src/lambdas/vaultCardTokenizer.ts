import { EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { CreatePaymentMethodBody } from "@mm/lib/lambdas";
import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import * as crypto from "node:crypto";
import { ZodError } from "zod";

import { isRetriableError } from "./helpers";

const { VAULT_CARD_TABLE_NAME, VAULT_KEY_ID } = process.env;
const kmsClient = new KMSClient({});

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{ customerId: string }> = async event => {
  try {
    const { cardNumber, ...cardData } = CreatePaymentMethodBody.parse(JSON.parse(event.body ?? ""));
    const { customerId } = event.requestContext.authorizer.lambda;
    const lastFour = cardNumber.substring(12);
    const token = crypto.randomBytes(32).toString("base64url");

    const { CiphertextBlob: cypher } = await kmsClient.send(
      new EncryptCommand({
        KeyId: VAULT_KEY_ID,
        Plaintext: Buffer.from(cardNumber),
        EncryptionContext: { token }
      })
    );

    await dbClient().send(
      new PutCommand({
        TableName: VAULT_CARD_TABLE_NAME,
        Item: { token, cypher, customerId, lastFour, ...cardData }
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify({ token })
    };
  } catch (err) {
    return processError(err);
  }
};

const processError = (err: unknown) => {
  let statusCode = 500;
  let message = "Internal";

  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Invalid card data";
  } else if (err instanceof SyntaxError) {
    statusCode = 400;
    message = "Request body was invalid JSON.";
  } else if (isRetriableError(err)) {
    statusCode = 503;
    message = "Too many requests or service unavailable. Try again shortly.";
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  return {
    statusCode,
    body: JSON.stringify({ message })
  };
};
