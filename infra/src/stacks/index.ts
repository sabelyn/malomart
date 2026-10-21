import type { Stage } from "aws-cdk-lib";

import { AlertsStack } from "./AlertsStack";
import { ApiStack } from "./ApiStack";
import { AuthDomainStack } from "./AuthDomainStack";
import type { GoogleAuthConfig } from "./AuthStack";
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
  siteDomain?: SiteDomain;
  redirectWww?: boolean;
  emailDomain?: string;
  alarmEmail?: string;
  fulfillmentTimeScale?: number;
  localDevOrigin?: string;
  googleAuth?: GoogleAuthConfig;
};

export const configureStacks = (stage: Stage, config: StageConfig) => {
  const alertsStack = new AlertsStack(stage, "MaloMartAlertsStack", { alarmEmail: config.alarmEmail });
  const dbStack = new DbStack(stage, "MaloMartDbStack", { alertsStack });
  const gatewayStack = new GatewayStack(stage, "MaloMartGatewayStack");
  const frontendStack = new FrontendStack(stage, "MaloMartFrontendStack", {
    alertsStack,
    dbStack,
    gatewayStack,
    siteDomain: config.siteDomain,
    redirectWww: config.redirectWww,
    localDevOrigin: config.localDevOrigin
  });
  const authStack = new AuthStack(stage, "MaloMartAuthStack", {
    dbStack,
    appOrigin: frontendStack.appOrigin,
    localDevOrigin: config.localDevOrigin,
    emailDomain: config.emailDomain,
    googleAuth: config.googleAuth
  });
  if (config.googleAuth) {
    const authDomainStack = new AuthDomainStack(stage, "MaloMartAuthDomainStack", {
      userPool: authStack.userPool,
      authDomain: config.googleAuth.authDomain
    });
    authDomainStack.addStackDependency(frontendStack);
  }
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
    vaultStack
  });
};
