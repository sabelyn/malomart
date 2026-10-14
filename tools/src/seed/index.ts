import { DeleteObjectsCommand, paginateListObjectsV2, PutObjectCommand } from "@aws-sdk/client-s3";
import type { BatchWriteCommandInput } from "@aws-sdk/lib-dynamodb";
import { BatchWriteCommand, GetCommand, paginateScan } from "@aws-sdk/lib-dynamodb";
import { dbClient, TableNames } from "@mm/clients/db";
import { BucketNames, IMAGE_KEY_PREFIX, imageHash, productImageKey, s3Client } from "@mm/clients/s3";
import { Product } from "@mm/lib/products";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { products } from "./products.ts";

type WriteRequests = NonNullable<BatchWriteCommandInput["RequestItems"]>[string];
type SeedImage = { key: string; data: Buffer };

const usage = `Usage:
  pnpm seed [options]
    Writes the seed catalog to the Dev stage's products table and uploads each product's images
    through the upload staging bucket so the image processor builds their variants.
    Re-running overwrites seeded products in place; their IDs are derived from their slugs.
    --reset           Delete every product and product image first, including ones not in the seed data.
    --skip-images     Write products only.
    --help            Show this message.`;

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUTPUTS_FILE = path.join(ROOT, "local/cdk-outputs.json");
const SPRITES_DIR = path.join(ROOT, "local/sprites");
const SEED_NAMESPACE = "7c2f0e1a-9b4d-4c8e-a5f3-2d6b8e1c4a90";
const IMAGE_WAIT_MS = 120_000;

const db = dbClient();
const s3 = s3Client();

const uuidV5 = (name: string) => {
  const namespace = Buffer.from(SEED_NAMESPACE.replaceAll("-", ""), "hex");
  const bytes = createHash("sha1").update(namespace).update(name).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
};

const loadOutputs = async () => {
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
  const bucketNames = outputs["Dev-MaloMartFrontendStack"]?.BucketNames;
  if (!bucketNames) {
    throw new Error(`No bucket names for Dev-MaloMartFrontendStack in ${OUTPUTS_FILE}. Run "pnpm deploy:dev".`);
  }
  return {
    tables: TableNames.parse(JSON.parse(tableNames)),
    buckets: BucketNames.parse(JSON.parse(bucketNames))
  };
};

const batchWrite = async (TableName: string, requests: WriteRequests) => {
  for (let i = 0; i < requests.length; i += 25) {
    let RequestItems: BatchWriteCommandInput["RequestItems"] = { [TableName]: requests.slice(i, i + 25) };
    for (let attempt = 0; RequestItems && Object.keys(RequestItems).length; attempt++) {
      if (attempt >= 5) {
        throw new Error(`Batch write to ${TableName} still had unprocessed items after ${attempt} attempts.`);
      }
      if (attempt) await sleep(100 * 2 ** attempt);
      ({ UnprocessedItems: RequestItems } = await db.send(new BatchWriteCommand({ RequestItems })));
    }
  }
};

const resetProducts = async (TableName: string, imageBucket: string) => {
  const ids: string[] = [];
  for await (const page of paginateScan({ client: db }, { TableName, ProjectionExpression: "id" })) {
    ids.push(...(page.Items ?? []).map(item => item.id as string));
  }
  await batchWrite(
    TableName,
    ids.map(id => ({ DeleteRequest: { Key: { id } } }))
  );
  console.log(`Deleted ${ids.length} products.`);

  let deleted = 0;
  const Prefix = `${IMAGE_KEY_PREFIX}products/`;
  for await (const page of paginateListObjectsV2({ client: s3 }, { Bucket: imageBucket, Prefix })) {
    const objects = (page.Contents ?? []).map(({ Key }) => ({ Key }));
    if (!objects.length) continue;
    await s3.send(new DeleteObjectsCommand({ Bucket: imageBucket, Delete: { Objects: objects, Quiet: true } }));
    deleted += objects.length;
  }
  console.log(`Deleted ${deleted} product image files.`);
};

const loadImages = async (id: string, slug: string, files: string[]) => {
  const images: SeedImage[] = [];
  for (const file of files) {
    const fullPath = path.join(SPRITES_DIR, file);
    if (!existsSync(fullPath)) {
      console.warn(`Missing image for ${slug}: ${fullPath}`);
      continue;
    }
    const data = await readFile(fullPath);
    images.push({ key: productImageKey(id, imageHash(data)), data });
  }
  return images;
};

const waitForImages = async (TableName: string, expected: Map<string, string[]>) => {
  const pending = new Map(expected);
  const deadline = Date.now() + IMAGE_WAIT_MS;
  while (pending.size && Date.now() < deadline) {
    await sleep(3000);
    await Promise.all(
      [...pending].map(async ([id, keys]) => {
        const { Item } = await db.send(new GetCommand({ TableName, Key: { id }, ProjectionExpression: "imageKeys" }));
        const stored = (Item?.imageKeys as Set<string> | undefined) ?? new Set();
        if (keys.every(key => stored.has(key))) pending.delete(id);
      })
    );
    console.log(`Processed images for ${expected.size - pending.size} of ${expected.size} products.`);
  }
  return pending;
};

const main = async () => {
  const { values: args } = parseArgs({
    options: {
      reset: { type: "boolean", default: false },
      "skip-images": { type: "boolean", default: false },
      help: { type: "boolean", default: false }
    }
  });
  if (args.help) {
    console.log(usage);
    return;
  }

  const slugs = products.map(p => p.slug);
  const duplicates = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicates.length) {
    throw new Error(`Duplicate product slugs in seed data: ${[...new Set(duplicates)].join(", ")}`);
  }

  const { tables, buckets } = await loadOutputs();
  const withImages = !args["skip-images"];

  if (args.reset) {
    await resetProducts(tables.products, buckets.image);
  }

  const seeded = await Promise.all(
    products.map(async seed => {
      const { slug, images: files, ...data } = seed;
      const id = uuidV5(slug);
      const images = withImages ? await loadImages(id, slug, files) : [];
      const item = Product.parse({
        id,
        ...data,
        inStock: data.stockCount > 0 ? 1 : 0,
        ...(images.length ? { thumbnailKey: images[0].key } : {})
      });
      return { item, images };
    })
  );

  await batchWrite(
    tables.products,
    seeded.map(({ item }) => ({ PutRequest: { Item: item } }))
  );
  console.log(`Wrote ${seeded.length} products to ${tables.products}.`);

  const withUploads = seeded.filter(({ images }) => images.length);
  if (!withUploads.length) return;

  await Promise.all(
    withUploads.flatMap(({ images }) =>
      images.map(({ key, data }) =>
        s3.send(new PutObjectCommand({ Bucket: buckets.uploadStaging, Key: key, Body: data }))
      )
    )
  );
  const imageCount = withUploads.reduce((sum, { images }) => sum + images.length, 0);
  console.log(`Uploaded ${imageCount} images to ${buckets.uploadStaging}. Waiting for the image processor...`);

  const pending = await waitForImages(
    tables.products,
    new Map(withUploads.map(({ item, images }) => [item.id, images.map(({ key }) => key)]))
  );
  if (pending.size) {
    const titles = seeded.filter(({ item }) => pending.has(item.id)).map(({ item }) => item.title);
    console.warn(`Timed out waiting for images on: ${titles.join(", ")}. Check the image processor's logs.`);
    process.exitCode = 1;
  }
};

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
