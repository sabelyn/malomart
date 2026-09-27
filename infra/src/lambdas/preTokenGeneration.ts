import type { PreTokenGenerationV2TriggerHandler } from "aws-lambda";

const ADMIN_GROUP = process.env.ADMIN_GROUP!;
const ADMIN_SCOPE = process.env.ADMIN_SCOPE!;

export const handler: PreTokenGenerationV2TriggerHandler = event => {
  const groups = event.request.groupConfiguration.groupsToOverride ?? [];

  if (groups.includes(ADMIN_GROUP)) {
    event.response.claimsAndScopeOverrideDetails = {
      accessTokenGeneration: { scopesToAdd: [ADMIN_SCOPE] }
    };
  }

  return Promise.resolve(event);
};
