import type { PreTokenGenerationV2TriggerEvent } from "aws-lambda";

import { handler } from "../../../src/lambdas/preTokenGeneration";
import { invoke } from "../../helpers/lambda";

const makeEvent = (groupsToOverride?: string[]) =>
  ({
    request: {
      groupConfiguration: { groupsToOverride },
      userAttributes: { email: "link@hyrule.test", name: "Link" }
    },
    response: {}
  }) as unknown as PreTokenGenerationV2TriggerEvent;

const accessTokenGeneration = async (groups?: string[]) =>
  (await invoke(handler, makeEvent(groups))).response.claimsAndScopeOverrideDetails?.accessTokenGeneration;

it("adds email and name claims to the access token", async () => {
  expect(await accessTokenGeneration(["customers"])).toEqual({
    claimsToAddOrOverride: { email: "link@hyrule.test", name: "Link" }
  });
});

it("adds the admin scope for admins", async () => {
  expect(await accessTokenGeneration(["customers", "admins"])).toMatchObject({ scopesToAdd: ["test/admin"] });
});

it("handles users with no groups", async () => {
  expect(await accessTokenGeneration()).not.toHaveProperty("scopesToAdd");
});
