import { readFileSync } from "node:fs";
import path from "node:path";

const OUTPUTS_FILE = path.resolve(__dirname, "../../../local/cdk-outputs.json");
const DB_STACK = "Local-MaloMartDbStack";

type StackOutputs = Record<string, Record<string, string>>;

const readDbStackOutputs = () => {
  let outputs: StackOutputs;
  try {
    outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm local:up" and "pnpm local:deploy" first.`, {
      cause: err
    });
  }

  const dbOutputs = outputs[DB_STACK];
  if (!dbOutputs) {
    throw new Error(`No outputs for ${DB_STACK} in ${OUTPUTS_FILE}. Run "pnpm local:deploy".`);
  }
  return dbOutputs;
};

const { TableNames, TableIndexes } = readDbStackOutputs();

delete process.env.AWS_PROFILE;
delete process.env.AWS_SESSION_TOKEN;

Object.assign(process.env, {
  AWS_ENDPOINT_URL: "http://localhost.localstack.cloud:4566",
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_REGION: "us-east-1",
  TABLE_NAMES: TableNames,
  TABLE_INDEXES: TableIndexes
});
