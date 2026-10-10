import type { Stage } from "aws-cdk-lib";

import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";
import { DbStack } from "./DbStack";
import { FrontendStack } from "./FrontendStack";
import { GatewayStack } from "./GatewayStack";
import { VaultStack } from "./VaultStack";

export type StageConfig = {
  apiTaskCount: number;
  frontend: boolean;
};

export const configureStacks = (stage: Stage, config: StageConfig) => {
  const dbStack = new DbStack(stage, "MaloMartDbStack");
  const gatewayStack = new GatewayStack(stage, "MaloMartGatewayStack");
  const frontendStack = config.frontend
    ? new FrontendStack(stage, "MaloMartFrontendStack", { dbStack, gatewayStack })
    : undefined;
  const authStack = new AuthStack(stage, "MaloMartAuthStack", { dbStack });
  const vaultStack = new VaultStack(stage, "MaloMartVaultStack", { authStack, gatewayStack });
  new ApiStack(stage, "MaloMartApiStack", {
    authStack,
    dbStack,
    appOrigin: frontendStack?.appOrigin,
    imageBucket: frontendStack?.imageBucket,
    uploadBucket: frontendStack?.uploadBucket,
    gatewayStack,
    vaultStack,
    taskCount: config.apiTaskCount
  });
};
