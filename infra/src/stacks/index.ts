import type { Stage } from "aws-cdk-lib";

import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";
import { DbStack } from "./DbStack";
import { DomainStack } from "./DomainStack";
import type { SiteDomain } from "./FrontendStack";
import { FrontendStack } from "./FrontendStack";
import { GatewayStack } from "./GatewayStack";
import { MailStack } from "./MailStack";
import { VaultStack } from "./VaultStack";

export { DomainStack, MailStack };

export type StageConfig = {
  apiTaskCount: number;
  siteDomain?: SiteDomain;
  emailDomain?: string;
};

export const configureStacks = (stage: Stage, config: StageConfig) => {
  const dbStack = new DbStack(stage, "MaloMartDbStack");
  const gatewayStack = new GatewayStack(stage, "MaloMartGatewayStack");
  const frontendStack = new FrontendStack(stage, "MaloMartFrontendStack", {
    dbStack,
    gatewayStack,
    siteDomain: config.siteDomain
  });
  const authStack = new AuthStack(stage, "MaloMartAuthStack", { dbStack, emailDomain: config.emailDomain });
  const vaultStack = new VaultStack(stage, "MaloMartVaultStack", { authStack, gatewayStack });
  new ApiStack(stage, "MaloMartApiStack", {
    authStack,
    dbStack,
    appOrigin: frontendStack.appOrigin,
    imageBucket: frontendStack.imageBucket,
    uploadBucket: frontendStack.uploadBucket,
    gatewayStack,
    vaultStack,
    taskCount: config.apiTaskCount
  });
};
