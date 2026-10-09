import { readFileSync } from "node:fs";
import path from "node:path";

const OUTPUTS_FILE = path.resolve(__dirname, "../../../local/cdk-outputs.json");
const DB_STACK = "Dev-MaloMartDbStack";
const VAULT_STACK = "Dev-MaloMartVaultStack";

type StackOutputs = Record<string, Record<string, string>>;

const readStackOutputs = () => {
  let outputs: StackOutputs;
  try {
    outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
  }

  for (const stack of [DB_STACK, VAULT_STACK]) {
    if (!outputs[stack]) {
      throw new Error(`No outputs for ${stack} in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
    }
  }
  return { db: outputs[DB_STACK], vault: outputs[VAULT_STACK] };
};

const { db, vault } = readStackOutputs();

delete process.env.AWS_REGION;

Object.assign(process.env, {
  INVOKE_FUNCTION_NAMES: vault.InvokeFunctionNames,
  VAULT_CARD_TABLE_NAME: vault.CardTableName,
  TABLE_NAMES: db.TableNames,
  TABLE_INDEXES: db.TableIndexes
});
