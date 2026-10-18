import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import { paginateScan, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, getItemsByIds, TableNames } from "@mm/clients/db";
import { ORDER_ENTITY_TYPE } from "@mm/lib/orders";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const MISSING_TITLE = "Discontinued item";

const usage = `Usage:
  pnpm backfill:orders [options]
    Brings orders in the Dev stage's orders table up to the current schema: sets the entityType used
    by the all-orders date index and saves each item's product title on the order.
    Items whose product was deleted get the title "${MISSING_TITLE}".
    --dry-run         Report what would change without writing anything.
    --help            Show this message.`;

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUTPUTS_FILE = path.join(ROOT, "local/cdk-outputs.json");

type StoredOrder = {
  id: string;
  entityType?: string;
  products: Record<string, { title?: string; amount: number; pricePerUnit: number }>;
};

const db = dbClient();

const loadTables = async () => {
  let outputs: Record<string, Record<string, string>>;
  try {
    outputs = JSON.parse(await readFile(OUTPUTS_FILE, "utf8"));
  } catch (err) {
    throw new Error(`Could not read ${OUTPUTS_FILE}. Run "pnpm deploy:dev" first.`, { cause: err });
  }

  const tableNames = outputs["Dev-MaloMartDbStack"]?.TableNames;
  if (!tableNames) {
    throw new Error(`No table names for Dev-MaloMartDbStack in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  return TableNames.parse(JSON.parse(tableNames));
};

const scanOrders = async (TableName: string) => {
  const orders: StoredOrder[] = [];
  const pages = paginateScan(
    { client: db },
    {
      TableName,
      ProjectionExpression: "id, entityType, products"
    }
  );
  for await (const page of pages) {
    orders.push(...((page.Items ?? []) as StoredOrder[]));
  }
  return orders;
};

const needsBackfill = (order: StoredOrder) =>
  order.entityType !== ORDER_ENTITY_TYPE || Object.values(order.products).some(item => !item.title);

const backfillOrder = async (TableName: string, order: StoredOrder, titles: Map<string, string>) => {
  const set = ["entityType = :entityType"];
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":entityType": ORDER_ENTITY_TYPE };
  Object.entries(order.products)
    .filter(([, item]) => !item.title)
    .forEach(([productId], i) => {
      names["#products"] = "products";
      names[`#p${i}`] = productId;
      values[`:t${i}`] = titles.get(productId) ?? MISSING_TITLE;
      set.push(`#products.#p${i}.title = :t${i}`);
    });

  try {
    await db.send(
      new UpdateCommand({
        TableName,
        Key: { id: order.id },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: `SET ${set.join(", ")}`,
        ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
        ExpressionAttributeValues: values
      })
    );
  } catch (err) {
    if (!(err instanceof ConditionalCheckFailedException)) {
      throw err;
    }
  }
};

const main = async () => {
  const { values: args } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (args.help) {
    console.log(usage);
    return;
  }

  const tables = await loadTables();
  const orders = (await scanOrders(tables.orders)).filter(needsBackfill);
  if (!orders.length) {
    console.log("Every order is already up to date.");
    return;
  }

  const productIds = [
    ...new Set(
      orders.flatMap(order =>
        Object.entries(order.products)
          .filter(([, item]) => !item.title)
          .map(([id]) => id)
      )
    )
  ];
  const products = await getItemsByIds<{ id: string; title: string }>(db, tables.products, productIds, "id, title");
  const titles = new Map(products.map(({ id, title }) => [id, title]));
  const missing = productIds.filter(id => !titles.has(id));

  console.log(
    `${orders.length} orders need a backfill, covering ${productIds.length} products (${missing.length} no longer exist).`
  );
  if (args["dry-run"]) {
    return;
  }

  for (const order of orders) {
    await backfillOrder(tables.orders, order, titles);
  }
  console.log(`Backfilled ${orders.length} orders in ${tables.orders}.`);
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
