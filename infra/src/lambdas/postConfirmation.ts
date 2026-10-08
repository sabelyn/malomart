import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { PostConfirmationTriggerHandler } from "aws-lambda";

const { CUSTOMER_GROUP, CUSTOMERS_TABLE_NAME } = process.env;

const cognito = new CognitoIdentityProviderClient({});
const db = dbClient();

export const handler: PostConfirmationTriggerHandler = async event => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }

  await Promise.all([
    cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username: event.userName,
        GroupName: CUSTOMER_GROUP
      })
    ),
    db.send(
      new PutCommand({
        TableName: CUSTOMERS_TABLE_NAME,
        Item: { id: event.request.userAttributes.sub }
      })
    )
  ]);

  return event;
};
