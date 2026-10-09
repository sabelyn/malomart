import { readFileSync } from "node:fs";
import path from "node:path";

const OUTPUTS_FILE = path.resolve(__dirname, "../../../local/cdk-outputs.json");
const VAULT_STACK = "Dev-MaloMartVaultStack";

type StackOutputs = Record<string, Record<string, string>>;

const readVaultStackOutputs = () => {
  let outputs: StackOutputs;
  try {
    outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
  }

  const vaultOutputs = outputs[VAULT_STACK];
  if (!vaultOutputs) {
    throw new Error(`No outputs for ${VAULT_STACK} in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  return vaultOutputs;
};

const { CardTableName, CardKeyArn } = readVaultStackOutputs();

delete process.env.AWS_REGION;

Object.assign(process.env, {
  VAULT_CARD_TABLE_NAME: CardTableName,
  VAULT_KEY_ID: CardKeyArn
});
