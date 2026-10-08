import { LegacyStackSynthesizer } from "aws-cdk-lib";
import type { Stage } from "aws-cdk-lib";

import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";
import { DbStack } from "./DbStack";
import { FrontendStack } from "./FrontendStack";
import { GatewayStack } from "./GatewayStack";
import { VaultStack } from "./VaultStack";

export const configureStacks = (stage: Stage) => {
  const dbStack = new DbStack(stage, "MaloMartDbStack");
  const gatewayStack = new GatewayStack(stage, "MaloMartGatewayStack");
  const frontendStack = new FrontendStack(stage, "MaloMartFrontendStack", { gatewayStack });
  const authStack = new AuthStack(stage, "MaloMartAuthStack", { dbStack });
  new VaultStack(stage, "MaloMartVaultStack", { authStack, gatewayStack });
  new ApiStack(stage, "MaloMartApiStack", { authStack, dbStack, frontendStack, gatewayStack });
};

export const configureLocalStacks = (stage: Stage) => {
  new DbStack(stage, "MaloMartDbStack", {
    synthesizer: new LegacyStackSynthesizer()
  });
};
