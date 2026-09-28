#!/usr/bin/env node
import type { StackProps } from "aws-cdk-lib";
import { App, Stage } from "aws-cdk-lib";
import { RemovalPolicies } from "aws-cdk-lib/core";

import { configureLocalStacks, configureStacks } from "./stacks";

const LOCALSTACK_ENV: StackProps["env"] = { account: "000000000000", region: "us-east-1" };

const stages: Record<string, StackProps["env"]> = {
  Dev: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION }
};

const app = new App();

if (app.node.tryGetContext("local")) {
  configureLocalStacks(new Stage(app, "MaloMartLocal", { env: LOCALSTACK_ENV, stageName: "Local" }));
} else {
  for (const [stageName, env] of Object.entries(stages)) {
    const stage = new Stage(app, `MaloMart${stageName}`, {
      env,
      stageName
    });
    configureStacks(stage);
  }
}

RemovalPolicies.of(app).destroy();
app.synth();
