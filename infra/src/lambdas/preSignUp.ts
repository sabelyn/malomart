import {
  AdminLinkProviderForUserCommand,
  CognitoIdentityProviderClient,
  ListUsersCommand
} from "@aws-sdk/client-cognito-identity-provider";
import type { PreSignUpTriggerHandler } from "aws-lambda";

const GOOGLE_PROVIDER = "Google";
const GOOGLE_PREFIX = `${GOOGLE_PROVIDER.toLowerCase()}_`;

const cognito = new CognitoIdentityProviderClient({});

const findNativeUsername = async (userPoolId: string, email: string) => {
  const { Users = [] } = await cognito.send(
    new ListUsersCommand({
      UserPoolId: userPoolId,
      Filter: `email = "${email.replace(/["\\]/g, "\\$&")}"`
    })
  );
  return Users.find(user => user.UserStatus !== "EXTERNAL_PROVIDER")?.Username;
};

export const handler: PreSignUpTriggerHandler = async event => {
  if (event.triggerSource !== "PreSignUp_ExternalProvider" || !event.userName.toLowerCase().startsWith(GOOGLE_PREFIX)) {
    return event;
  }

  const { email, email_verified } = event.request.userAttributes;
  if (!email || email_verified !== "true") {
    return event;
  }

  const nativeUsername = await findNativeUsername(event.userPoolId, email);
  if (nativeUsername) {
    await cognito.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: event.userPoolId,
        DestinationUser: { ProviderName: "Cognito", ProviderAttributeValue: nativeUsername },
        SourceUser: {
          ProviderName: GOOGLE_PROVIDER,
          ProviderAttributeName: "Cognito_Subject",
          ProviderAttributeValue: event.userName.slice(GOOGLE_PREFIX.length)
        }
      })
    );
  }

  return event;
};
