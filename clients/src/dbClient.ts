import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

let baseClient: DynamoDBDocumentClient;
export const dbClient = () => {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  baseClient ??= DynamoDBDocumentClient.from(new DynamoDBClient(endpoint ? { endpoint } : {}));
  return baseClient;
}
