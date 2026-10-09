import { readFileSync, writeFileSync } from "fs";
import path from "path";

const OUTPUTS_FILE = path.resolve(__dirname, "../../local/cdk-outputs.json");
const ENV_FILE = path.resolve(__dirname, "../.env.local");

type StackOutputs = Record<string, Record<string, string>>;

let outputs: StackOutputs;
try {
  outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
} catch (err) {
  throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
}

const stackOutputs = (name: string) => {
  const stack = outputs[`Dev-${name}`];
  if (!stack) {
    throw new Error(`No outputs for Dev-${name} in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  return stack;
};

const auth = stackOutputs("MaloMartAuthStack");
const db = stackOutputs("MaloMartDbStack");
const vault = stackOutputs("MaloMartVaultStack");

const env = {
  ADMIN_SCOPE: auth.AdminScope,
  INVOKE_FUNCTION_NAMES: vault.InvokeFunctionNames,
  NODE_ENV: "development",
  TABLE_INDEXES: db.TableIndexes,
  TABLE_NAMES: db.TableNames,
  USER_POOL_ID: auth.UserPoolId,
  USER_POOL_CLIENT_ID: auth.UserPoolClientId
};

writeFileSync(
  ENV_FILE,
  Object.entries(env)
    .map(([key, value]) => `${key}='${value}'\n`)
    .join("")
);
console.log(`Wrote ${ENV_FILE}`);
