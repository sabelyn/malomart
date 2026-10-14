#!/usr/bin/env node
import type { StackProps } from "aws-cdk-lib";
import { App, Stage } from "aws-cdk-lib";
import { RemovalPolicies } from "aws-cdk-lib/core";
import { existsSync } from "node:fs";

import type { StageConfig } from "./stacks";
import { configureStacks, DomainStack, MailStack } from "./stacks";

const DOMAIN_NAME = "malomart.link";

if (existsSync(".env")) {
  process.loadEnvFile();
}

const app = new App();
const env: StackProps["env"] = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION };

const domainStack = new DomainStack(app, "MaloMartDomain", { env, domainName: DOMAIN_NAME });
new MailStack(app, "MaloMartMail", { env, zone: domainStack.zone, inboxDomain: `inbox.${DOMAIN_NAME}` });

const stages: Record<string, { env: StackProps["env"]; config: StageConfig }> = {
  Dev: {
    env,
    config: {
      apiTaskCount: Number(app.node.tryGetContext("apiTasks") ?? 0),
      siteDomain: { zoneName: DOMAIN_NAME, hostName: `dev.${DOMAIN_NAME}` },
      emailDomain: DOMAIN_NAME,
      alarmEmail: process.env.DEV_ALARM_EMAIL
    }
  }
};

for (const [stageName, { env, config }] of Object.entries(stages)) {
  const stage = new Stage(app, `MaloMart${stageName}`, {
    env,
    stageName
  });
  configureStacks(stage, config);
  RemovalPolicies.of(stage).destroy();
}

app.synth();
