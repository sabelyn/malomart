import { AdminAddUserToGroupCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { PostConfirmationTriggerHandler } from "aws-lambda";

const CUSTOMER_GROUP = process.env.CUSTOMER_GROUP!;

const cognito = new CognitoIdentityProviderClient({});

export const handler: PostConfirmationTriggerHandler = async event => {
  if (event.triggerSource !== "PostConfirmation_ConfirmSignUp") {
    return event;
  }

  await cognito.send(new AdminAddUserToGroupCommand({
    UserPoolId: event.userPoolId,
    Username: event.userName,
    GroupName: CUSTOMER_GROUP
  }));

  return event;
};
