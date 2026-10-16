import { dbClient } from "@mm/clients";
import { readFileSync } from "node:fs";
import path from "node:path";

import { deleteTracked, wasTouched } from "../helpers/db";
import { drainQueues } from "../helpers/queues";

const OUTPUTS_FILE = path.resolve(__dirname, "../../../local/cdk-outputs.json");
const DB_STACK = "Dev-MaloMartDbStack";
const VAULT_STACK = "Dev-MaloMartVaultStack";
const ORDERS_STACK = "Dev-MaloMartOrdersStack";

type StackOutputs = Record<string, Record<string, string>>;

const readStackOutputs = () => {
  let outputs: StackOutputs;
  try {
    outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
  }

  for (const stack of [DB_STACK, VAULT_STACK, ORDERS_STACK]) {
    if (!outputs[stack]) {
      throw new Error(`No outputs for ${stack} in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
    }
  }
  return { db: outputs[DB_STACK], vault: outputs[VAULT_STACK], orders: outputs[ORDERS_STACK] };
};

const { db, vault, orders } = readStackOutputs();

delete process.env.AWS_REGION;

Object.assign(process.env, {
  INVOKE_FUNCTION_NAMES: vault.InvokeFunctionNames,
  VAULT_CARD_TABLE_NAME: vault.CardTableName,
  TABLE_NAMES: db.TableNames,
  TABLE_INDEXES: db.TableIndexes
});

afterEach(() => deleteTracked(dbClient()));

afterAll(async () => {
  if (wasTouched(JSON.parse(db.TableNames).orders)) {
    await drainQueues(JSON.parse(orders.FailureQueueUrls));
  }
}, 60_000);
