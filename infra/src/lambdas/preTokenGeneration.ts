import type { PreTokenGenerationV2TriggerHandler } from "aws-lambda";

const ADMIN_GROUP = process.env.ADMIN_GROUP!;
const ADMIN_SCOPE = process.env.ADMIN_SCOPE!;

export const handler: PreTokenGenerationV2TriggerHandler = event => {
  const groups = event.request.groupConfiguration.groupsToOverride ?? [];
  const { email, name } = event.request.userAttributes;

  event.response.claimsAndScopeOverrideDetails = {
    accessTokenGeneration: {
      claimsToAddOrOverride: { email, name },
      ...(groups.includes(ADMIN_GROUP) ? { scopesToAdd: [ADMIN_SCOPE] } : {})
    }
  };

  return Promise.resolve(event);
};
