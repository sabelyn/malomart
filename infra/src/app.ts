#!/usr/bin/env node
import type { StackProps } from "aws-cdk-lib";
import { App, Stage } from "aws-cdk-lib";
import { RemovalPolicies } from "aws-cdk-lib/core";

import type { StageConfig } from "./stacks";
import { configureStacks } from "./stacks";

const app = new App();

const stages: Record<string, { env: StackProps["env"]; config: StageConfig }> = {
  Dev: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
    config: {
      apiTaskCount: Number(app.node.tryGetContext("apiTasks") ?? 0),
      frontend: String(app.node.tryGetContext("skipFrontend")) !== "true"
    }
  }
};

for (const [stageName, { env, config }] of Object.entries(stages)) {
  const stage = new Stage(app, `MaloMart${stageName}`, {
    env,
    stageName
  });
  configureStacks(stage, config);
}

RemovalPolicies.of(app).destroy();
app.synth();
