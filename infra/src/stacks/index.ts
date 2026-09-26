import type { Stage } from "aws-cdk-lib";

import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";

export const configureStacks = (stage: Stage) => {
  const authStack = new AuthStack(stage, "MaloMartAuthStack");
  new ApiStack(stage, "MaloMartApiStack", { authStack });
}
