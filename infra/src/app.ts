#!/usr/bin/env node
import { App, Stage } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";

import { configureStacks } from "./stacks";

const stages: Record<string, StackProps["env"]> = {
  Dev: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
};

const app = new App();

for (const [stageName, env] of Object.entries(stages)) {
  const stage = new Stage(app, `MaloMart${stageName}`, {
    env,
    stageName
  });
  configureStacks(stage);
}

app.synth();
