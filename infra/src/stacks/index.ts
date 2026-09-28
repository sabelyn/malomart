import { LegacyStackSynthesizer } from "aws-cdk-lib";
import type { Stage } from "aws-cdk-lib";

import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";
import { DbStack } from "./DbStack";

export const configureStacks = (stage: Stage) => {
  const dbStack = new DbStack(stage, "MaloMartDbStack");
  const authStack = new AuthStack(stage, "MaloMartAuthStack");
  new ApiStack(stage, "MaloMartApiStack", { authStack, dbStack });
};

export const configureLocalStacks = (stage: Stage) => {
  new DbStack(stage, "MaloMartDbStack", {
    synthesizer: new LegacyStackSynthesizer()
  });
};
