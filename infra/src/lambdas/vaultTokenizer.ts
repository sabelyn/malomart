import { EncryptCommand, KMSClient } from "@aws-sdk/client-kms";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { CreatePaymentMethodBody } from "@mm/lib/lambdas";
import type { APIGatewayProxyHandlerV2WithLambdaAuthorizer } from "aws-lambda";
import * as crypto from "node:crypto";
import { ZodError } from "zod";

const { VAULT_CARD_TABLE_NAME, VAULT_KEY_ID } = process.env;
const kmsClient = new KMSClient({});

const THROTTLING_ERRORS = new Set(["ThrottlingException", "ProvisionedThroughputExceededException", "RequestLimitExceeded"]);
const TRANSIENT_ERRORS = new Set([
  "KeyUnavailableException",
  "DependencyTimeoutException",
  "KMSInternalException",
  "InternalServerError"
]);

export const handler: APIGatewayProxyHandlerV2WithLambdaAuthorizer<{ customerId: string }> = async event => {
  try {
    const { cardNumber, ...cardData } = CreatePaymentMethodBody.parse(JSON.parse(event.body ?? ""));
    const { customerId } = event.requestContext.authorizer.lambda;
    const lastFour = cardNumber.substring(12);
    const token = crypto.randomBytes(32).toString("base64url");

    const { CiphertextBlob: cypher } = await kmsClient.send(new EncryptCommand({
      KeyId: VAULT_KEY_ID,
      Plaintext: Buffer.from(cardNumber),
      EncryptionContext: { token }
    }));

    await dbClient().send(new PutCommand({
      TableName: VAULT_CARD_TABLE_NAME,
      Item: { token, cypher, customerId, lastFour, ...cardData }
    }));

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
  } else if (err instanceof Error && THROTTLING_ERRORS.has(err.name)) {
    statusCode = 503;
    message = "Too many requests. Try again shortly.";
  } else if (err instanceof Error && TRANSIENT_ERRORS.has(err.name)) {
    statusCode = 503;
    message = "Card storage is temporarily unavailable. Try again shortly.";
  }

  if (statusCode >= 500) {
    console.error(err);
  }

  return {
    statusCode,
    body: JSON.stringify({ message })
  }
}
