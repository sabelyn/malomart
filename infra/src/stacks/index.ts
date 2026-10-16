import type { Stage } from "aws-cdk-lib";

import { AlertsStack } from "./AlertsStack";
import { ApiStack } from "./ApiStack";
import { AuthStack } from "./AuthStack";
import { DbStack } from "./DbStack";
import { DomainStack } from "./DomainStack";
import type { SiteDomain } from "./FrontendStack";
import { FrontendStack } from "./FrontendStack";
import { GatewayStack } from "./GatewayStack";
import { MailStack } from "./MailStack";
import { OrdersStack } from "./OrdersStack";
import { VaultStack } from "./VaultStack";

export { DomainStack, MailStack };

export type StageConfig = {
  apiTaskCount: number;
  siteDomain?: SiteDomain;
  emailDomain?: string;
  alarmEmail?: string;
  fulfillmentTimeScale?: number;
};

export const configureStacks = (stage: Stage, config: StageConfig) => {
  const alertsStack = new AlertsStack(stage, "MaloMartAlertsStack", { alarmEmail: config.alarmEmail });
  const dbStack = new DbStack(stage, "MaloMartDbStack", { alertsStack });
  const gatewayStack = new GatewayStack(stage, "MaloMartGatewayStack");
  const frontendStack = new FrontendStack(stage, "MaloMartFrontendStack", {
    alertsStack,
    dbStack,
    gatewayStack,
    siteDomain: config.siteDomain
  });
  const authStack = new AuthStack(stage, "MaloMartAuthStack", { dbStack, emailDomain: config.emailDomain });
  const vaultStack = new VaultStack(stage, "MaloMartVaultStack", { alertsStack, authStack, gatewayStack });
  new OrdersStack(stage, "MaloMartOrdersStack", {
    alertsStack,
    authStack,
    dbStack,
    vaultStack,
    appOrigin: frontendStack.appOrigin,
    emailDomain: config.emailDomain,
    timeScale: config.fulfillmentTimeScale ?? 1
  });
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
