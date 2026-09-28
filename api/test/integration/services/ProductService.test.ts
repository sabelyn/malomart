import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients";
import type { CreateProductBody, Product } from "@mm/lib";
import { Category } from "@mm/lib";

import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { ProductService } from "@/services";
import { clearTable, putItems } from "../../helpers/db";

const TableName = env.TABLE_NAMES.products;
const db = dbClient();
const service = new ProductService(db);

const productData: CreateProductBody = {
  title: "Mask of Truth",
  description: "Allows you to see into the minds of others.",
  category: Category.Masks,
  price: 80,
  inStock: 2
};

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: crypto.randomUUID(),
  ...productData,
  ...overrides
});

const getRawItem = async (id: string) => (await db.send(new GetCommand({ TableName, Key: { id } }))).Item;

beforeEach(async () => {
  await clearTable(db, TableName, ["id"]);
});

describe("createProduct", () => {
  it("stores the product with a generated id and returns it", async () => {
    const created = await service.createProduct(productData);

    expect(created).toEqual({ id: expect.any(String), ...productData });
    expect(await getRawItem(created.id)).toEqual(created);
  });

  it("generates a unique id for each product", async () => {
    const first = await service.createProduct(productData);
    const second = await service.createProduct(productData);

    expect(first.id).not.toBe(second.id);
  });
});

describe("getProduct", () => {
  it("returns an existing product", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);

    await expect(service.getProduct(product.id)).resolves.toEqual(product);
  });

  it("throws a 404 when the product does not exist", async () => {
    const result = service.getProduct(crypto.randomUUID());

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 500 when the stored product is malformed", async () => {
    const product = makeProduct({ price: -1 });
    await putItems(db, TableName, [product]);

    const result = service.getProduct(product.id);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("updateProduct", () => {
  it("updates only the provided fields", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);

    const updated = await service.updateProduct(product.id, { price: 120 });

    expect(updated).toEqual({ ...product, price: 120 });
    expect(await getRawItem(product.id)).toEqual({ ...product, price: 120 });
  });

  it("updates multiple fields at once", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);
    const changes = { title: "Mask of Lies", description: "Hides your thoughts from others.", price: 90 };

    await expect(service.updateProduct(product.id, changes)).resolves.toEqual({ ...product, ...changes });
  });

  it("throws a 404 and does not create the product when it does not exist", async () => {
    const id = crypto.randomUUID();
    const result = service.updateProduct(id, { price: 120 });

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(await getRawItem(id)).toBeUndefined();
  });
});

describe("deleteProduct", () => {
  it("removes the product", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);

    await service.deleteProduct(product.id);

    expect(await getRawItem(product.id)).toBeUndefined();
  });

  it("does not throw when the product does not exist", async () => {
    await expect(service.deleteProduct(crypto.randomUUID())).resolves.toBeUndefined();
  });
});

describe("listProducts", () => {
  const toOverview = ({ id, title, price }: Product) => ({ id, title, price });
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

  const listAll = async (query: Omit<Parameters<typeof service.listProducts>[0], "cursor">) => {
    const pages = [];
    let cursor: string | undefined;
    do {
      const page = await service.listProducts({ ...query, cursor });
      pages.push(page);
      cursor = page.pagination.cursor;
    } while (cursor);
    return pages;
  };

  it("returns an empty page when there are no products", async () => {
    await expect(service.listProducts({ limit: 20 })).resolves.toEqual({
      data: [],
      pagination: { limit: 20, hasNext: false, cursor: undefined }
    });
  });

  it("returns overviews of all products", async () => {
    const products = [makeProduct(), makeProduct({ category: Category.Weapons })];
    await putItems(db, TableName, products);

    const result = await service.listProducts({ limit: 20 });

    expect(result.data.toSorted(byId)).toEqual(products.map(toOverview).toSorted(byId));
    expect(result.pagination).toEqual({ limit: 20, hasNext: false, cursor: undefined });
  });

  it("filters by category using the category index", async () => {
    const masks = [makeProduct(), makeProduct()];
    await putItems(db, TableName, [...masks, makeProduct({ category: Category.Weapons })]);

    const result = await service.listProducts({ limit: 20, category: Category.Masks });

    expect(result.data).toEqual(masks.map(toOverview).toSorted(byId));
  });

  it("filters out products that are out of stock", async () => {
    const inStock = makeProduct({ inStock: 1 });
    await putItems(db, TableName, [inStock, makeProduct({ inStock: 0 })]);

    const result = await service.listProducts({ limit: 20, inStock: true });

    expect(result.data).toEqual([toOverview(inStock)]);
  });

  it("combines the category and stock filters", async () => {
    const match = makeProduct({ inStock: 3 });
    await putItems(db, TableName, [
      match,
      makeProduct({ inStock: 0 }),
      makeProduct({ category: Category.Weapons, inStock: 3 })
    ]);

    const result = await service.listProducts({ limit: 20, category: Category.Masks, inStock: true });

    expect(result.data).toEqual([toOverview(match)]);
  });

  it.each([
    ["all products", {}, () => true],
    ["a category", { category: Category.Masks }, (p: Product) => p.category === Category.Masks],
    ["in-stock products", { inStock: true }, (p: Product) => p.inStock > 0]
  ])("paginates through %s without duplicates or gaps", async (_, filters, predicate) => {
    const products = Array.from({ length: 25 }, (_, i) =>
      makeProduct({ category: i % 2 ? Category.Masks : Category.Potions, inStock: i % 3 })
    );
    await putItems(db, TableName, products);

    const pages = await listAll({ limit: 10, ...filters });

    for (const page of pages) {
      expect(page.data.length).toBeLessThanOrEqual(10);
    }
    expect(pages.at(-1)!.pagination.hasNext).toBe(false);
    expect(pages.flatMap(page => page.data).toSorted(byId)).toEqual(
      products.filter(predicate).map(toOverview).toSorted(byId)
    );
  });

  it.each([
    ["is not valid base64 JSON", "not-a-cursor"],
    ["has keys that do not match the query", Buffer.from(JSON.stringify({ other: "x" })).toString("base64url")]
  ])("throws a 400 when the cursor %s", async (_, cursor) => {
    const result = service.listProducts({ limit: 20, cursor });

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws a 400 when a table cursor is used with a category query", async () => {
    await putItems(
      db,
      TableName,
      Array.from({ length: 15 }, () => makeProduct())
    );
    const { pagination } = await service.listProducts({ limit: 10 });

    const result = service.listProducts({ limit: 10, category: Category.Masks, cursor: pagination.cursor });

    await expect(result).rejects.toMatchObject({ statusCode: 400 });
  });
});
