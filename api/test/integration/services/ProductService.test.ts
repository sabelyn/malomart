import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, s3Client } from "@mm/clients";
import type { CreateProductBody, Product } from "@mm/lib";
import { Category } from "@mm/lib";
import { mockClient } from "aws-sdk-client-mock";

import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { ProductService } from "@/services";
import { putItems, track } from "../../helpers/db";

const TableName = env.TABLE_NAMES.products;
const db = dbClient();
const s3 = mockClient(s3Client());
const service = new ProductService(db, s3Client());

const productData: CreateProductBody = {
  title: "Mask of Truth",
  description: "Allows you to see into the minds of others.",
  category: Category.Masks,
  price: 80,
  stockCount: 2,
  features: ["Reveals hidden truths"]
};

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: crypto.randomUUID(),
  ...productData,
  inStock: (overrides.stockCount ?? productData.stockCount) > 0 ? 1 : 0,
  ...overrides
});

const toDto = ({ inStock: _, imageKeys, ...product }: Product) => ({ ...product, imageKeys: [...(imageKeys ?? [])] });

const toOverview = ({ id, title, price, stockCount }: Product) => ({ id, title, price, stockCount });

const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

const getRawItem = async (id: string) => (await db.send(new GetCommand({ TableName, Key: { id } }))).Item;

const createProduct = async (data: CreateProductBody) => {
  const created = await service.createProduct(data);
  track(TableName, { id: created.id });
  return created;
};

beforeEach(() => {
  s3.reset();
});

describe("createProduct", () => {
  it("stores the product with a generated id and returns it", async () => {
    const created = await createProduct(productData);

    expect(created).toEqual({ id: expect.any(String), ...productData, imageKeys: [] });
    expect(await getRawItem(created.id)).toEqual({ id: created.id, ...productData, inStock: 1 });
  });

  it("marks a product with no stock as out of stock", async () => {
    const created = await createProduct({ ...productData, stockCount: 0 });

    expect(created).not.toHaveProperty("inStock");
    expect(await getRawItem(created.id)).toMatchObject({ stockCount: 0, inStock: 0 });
  });

  it("generates a unique id for each product", async () => {
    const first = await createProduct(productData);
    const second = await createProduct(productData);

    expect(first.id).not.toBe(second.id);
  });
});

describe("getProduct", () => {
  it("returns an existing product", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);

    await expect(service.getProduct(product.id)).resolves.toEqual(toDto(product));
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

    expect(updated).toEqual({ ...toDto(product), price: 120 });
    expect(await getRawItem(product.id)).toEqual({ ...product, price: 120 });
  });

  it("updates multiple fields at once", async () => {
    const product = makeProduct();
    await putItems(db, TableName, [product]);
    const changes = { title: "Mask of Lies", description: "Hides your thoughts from others.", price: 90 };

    await expect(service.updateProduct(product.id, changes)).resolves.toEqual({ ...toDto(product), ...changes });
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

describe("getProducts", () => {
  it("returns an empty list when given no ids", async () => {
    await expect(service.getProducts([])).resolves.toEqual([]);
  });

  it("returns the overview of a single product", async () => {
    const product = makeProduct({ originalPrice: 100, thumbnailKey: "products/x/thumb" });
    await putItems(db, TableName, [product]);

    await expect(service.getProducts([product.id])).resolves.toEqual([
      { ...toOverview(product), originalPrice: 100, thumbnailKey: "products/x/thumb" }
    ]);
  });

  it("returns the overviews of multiple products", async () => {
    const products = [makeProduct(), makeProduct({ stockCount: 0 }), makeProduct({ price: 5 })];
    await putItems(db, TableName, products);

    const result = await service.getProducts(products.map(p => p.id));

    expect(result.toSorted(byId)).toEqual(products.map(toOverview).toSorted(byId));
  });

  it("returns each product once when ids are repeated", async () => {
    const products = [makeProduct(), makeProduct()];
    await putItems(db, TableName, products);

    const result = await service.getProducts([products[0].id, products[1].id, products[0].id]);

    expect(result.toSorted(byId)).toEqual(products.map(toOverview).toSorted(byId));
  });

  it.each([
    ["a single", 0],
    ["one of several", 2]
  ])("leaves out %s product that does not exist", async (_, existing) => {
    const products = Array.from({ length: existing }, () => makeProduct());
    await putItems(db, TableName, products);

    const result = await service.getProducts([...products.map(p => p.id), crypto.randomUUID()]);

    expect(result.toSorted(byId)).toEqual(products.map(toOverview).toSorted(byId));
  });
});

describe("getProductStocks", () => {
  it("returns an empty map when given no ids", async () => {
    await expect(service.getProductStocks([])).resolves.toEqual({});
  });

  it("returns the stock of a single product", async () => {
    const product = makeProduct({ stockCount: 7 });
    await putItems(db, TableName, [product]);

    await expect(service.getProductStocks([product.id])).resolves.toEqual({ [product.id]: 7 });
  });

  it("returns the stock of multiple products by id", async () => {
    const products = [makeProduct({ stockCount: 3 }), makeProduct({ stockCount: 0 }), makeProduct({ stockCount: 12 })];
    await putItems(db, TableName, products);

    await expect(service.getProductStocks(products.map(p => p.id))).resolves.toEqual(
      Object.fromEntries(products.map(p => [p.id, p.stockCount]))
    );
  });

  it("returns each product once when ids are repeated", async () => {
    const products = [makeProduct({ stockCount: 3 }), makeProduct({ stockCount: 4 })];
    await putItems(db, TableName, products);

    await expect(service.getProductStocks([products[0].id, products[1].id, products[1].id])).resolves.toEqual({
      [products[0].id]: 3,
      [products[1].id]: 4
    });
  });

  it.each([
    ["a single", 0],
    ["one of several", 2]
  ])("leaves out %s product that does not exist", async (_, existing) => {
    const products = Array.from({ length: existing }, () => makeProduct({ stockCount: 3 }));
    await putItems(db, TableName, products);

    const result = await service.getProductStocks([...products.map(p => p.id), crypto.randomUUID()]);

    expect(result).toEqual(Object.fromEntries(products.map(p => [p.id, 3])));
  });
});

describe("listProducts", () => {
  type ListQuery = Omit<Parameters<typeof service.listProducts>[0], "cursor">;

  const listAll = async (query: ListQuery) => {
    const pages = [];
    let cursor: string | undefined;
    do {
      const page = await service.listProducts({ ...query, cursor });
      pages.push(page);
      cursor = page.pagination.cursor;
    } while (cursor);
    return pages;
  };

  const listOwn = async (products: Product[], query: ListQuery) => {
    const ids = new Set(products.map(p => p.id));
    const pages = await listAll(query);
    return pages.flatMap(page => page.data).filter(item => ids.has(item.id));
  };

  it("returns overviews of all products", async () => {
    const products = [makeProduct(), makeProduct({ category: Category.Weapons })];
    await putItems(db, TableName, products);

    const result = await listOwn(products, { limit: 100 });

    expect(result.toSorted(byId)).toEqual(products.map(toOverview).toSorted(byId));
  });

  it("filters by category using the category index", async () => {
    const masks = [makeProduct(), makeProduct()];
    const products = [...masks, makeProduct({ category: Category.Weapons })];
    await putItems(db, TableName, products);

    const result = await listOwn(products, { limit: 100, category: Category.Masks });

    expect(result).toEqual(masks.map(toOverview).toSorted(byId));
  });

  it("filters out products that are out of stock", async () => {
    const inStock = makeProduct({ stockCount: 1 });
    const products = [inStock, makeProduct({ stockCount: 0 })];
    await putItems(db, TableName, products);

    const result = await listOwn(products, { limit: 100, inStock: true });

    expect(result).toEqual([toOverview(inStock)]);
  });

  it("combines the category and stock filters using the category stock index", async () => {
    const matches = [makeProduct({ stockCount: 3 }), makeProduct({ stockCount: 1 })];
    const products = [
      ...matches,
      makeProduct({ stockCount: 0 }),
      makeProduct({ category: Category.Weapons, stockCount: 3 })
    ];
    await putItems(db, TableName, products);

    const result = await listOwn(products, { limit: 100, category: Category.Masks, inStock: true });

    expect(result).toEqual(matches.map(toOverview).toSorted(byId));
  });

  it.each([
    ["all products", {}, () => true],
    ["a category", { category: Category.Masks }, (p: Product) => p.category === Category.Masks],
    ["in-stock products", { inStock: true }, (p: Product) => p.stockCount > 0],
    [
      "in-stock products in a category",
      { category: Category.Masks, inStock: true },
      (p: Product) => p.category === Category.Masks && p.stockCount > 0
    ]
  ])("paginates through %s without duplicates or gaps", async (_, filters, predicate) => {
    const products = Array.from({ length: 25 }, (_, i) =>
      makeProduct({ category: i % 2 ? Category.Masks : Category.Potions, stockCount: i % 3 })
    );
    await putItems(db, TableName, products);

    const pages = await listAll({ limit: 10, ...filters });
    const all = pages.flatMap(page => page.data);
    const ids = new Set(products.map(p => p.id));

    for (const page of pages) {
      expect(page.data.length).toBeLessThanOrEqual(10);
    }
    expect(pages.at(-1)!.pagination.hasNext).toBe(false);
    expect(new Set(all.map(item => item.id)).size).toBe(all.length);
    expect(all.filter(item => ids.has(item.id)).toSorted(byId)).toEqual(
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
