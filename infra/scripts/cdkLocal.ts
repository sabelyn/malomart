import { spawn } from "node:child_process";

const LOCALSTACK_URL = "http://localhost.localstack.cloud:4566";

const env: NodeJS.ProcessEnv = {
  ...process.env,
  AWS_ENDPOINT_URL: LOCALSTACK_URL,
  AWS_ENDPOINT_URL_S3: "http://s3.localhost.localstack.cloud:4566",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_REGION: "us-east-1",
  AWS_DEFAULT_REGION: "us-east-1"
};
delete env.AWS_PROFILE;
delete env.AWS_SESSION_TOKEN;

const assertLocalStackRunning = async () => {
  try {
    const res = await fetch(`${LOCALSTACK_URL}/_localstack/health`);
    if (!res.ok) throw new Error(`Health check returned ${res.status}`);
  } catch (err) {
    console.error(`LocalStack is not reachable at ${LOCALSTACK_URL}. Start it with "pnpm local:up".`, err);
    process.exit(1);
  }
};

const main = async () => {
  await assertLocalStackRunning();

  const cdkBin = require.resolve("aws-cdk/bin/cdk");
  const child = spawn(process.execPath, [cdkBin, "--context", "local=true", ...process.argv.slice(2)], {
    env,
    stdio: "inherit"
  });
  child.on("exit", code => process.exit(code ?? 1));
};

void main();
