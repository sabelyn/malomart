import type { ListProductsResponse, ProductDto } from "@mm/lib";
import request from "supertest";
import { container } from "tsyringe";

import type { IProductService } from "@/contracts";
import { PRODUCT_SERVICE } from "@/contracts/tokens";
import { ApiError } from "@/errors/ApiError";
import api from "@/routes";
import { asAdmin, asRegularUser, createTestApp } from "../../helpers/testApp";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const product: ProductDto = {
  id: ID,
  title: "Mask of Truth",
  description: "Allows you to see into the minds of others.",
  category: "Masks",
  price: 80,
  inStock: 2
};

const productData = {
  title: product.title,
  description: product.description,
  category: product.category,
  price: product.price,
  inStock: product.inStock
};

const listResult: ListProductsResponse = {
  data: [{ id: ID, title: product.title, price: product.price }],
  pagination: { hasNext: false, limit: 20 }
};

const app = createTestApp(api);

let service: { [K in keyof IProductService]: ReturnType<typeof vi.fn<IProductService[K]>> };

beforeEach(() => {
  service = {
    createProduct: vi.fn<IProductService["createProduct"]>().mockResolvedValue(product),
    deleteProduct: vi.fn<IProductService["deleteProduct"]>().mockResolvedValue(),
    getProduct: vi.fn<IProductService["getProduct"]>().mockResolvedValue(product),
    listProducts: vi.fn<IProductService["listProducts"]>().mockResolvedValue(listResult),
    updateProduct: vi.fn<IProductService["updateProduct"]>().mockResolvedValue(product)
  };
  container.registerInstance(PRODUCT_SERVICE, service);
});

describe("GET /products", () => {
  it("lists products with default pagination", async () => {
    const res = await request(app).get("/products");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listResult);
    expect(service.listProducts).toHaveBeenCalledWith({ limit: 20 });
  });

  it("parses query parameters", async () => {
    await request(app).get("/products").query({ limit: "50", category: "Weapons", inStock: "true", cursor: "abc" });

    expect(service.listProducts).toHaveBeenCalledWith({ limit: 50, category: "Weapons", inStock: true, cursor: "abc" });
  });

  it.each([
    ["a limit below the minimum", { limit: "5" }],
    ["a non-numeric limit", { limit: "lots" }],
    ["an unknown category", { category: "Rupees" }],
    ["a non-boolean inStock", { inStock: "maybe" }]
  ])("rejects %s with a 400", async (_, query) => {
    const res = await request(app).get("/products").query(query);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Request validation failed.");
    expect(res.body.details).toBeDefined();
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it("passes through service errors", async () => {
    service.listProducts.mockRejectedValue(new ApiError(400, "Invalid cursor."));

    const res = await request(app).get("/products").query({ cursor: "bad" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid cursor." });
  });
});

describe("GET /products/:id", () => {
  it("returns the product without requiring auth", async () => {
    const res = await request(app).get(`/products/${ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.getProduct).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).get("/products/not-a-uuid");

    expect(res.status).toBe(400);
    expect(service.getProduct).not.toHaveBeenCalled();
  });

  it("returns a 404 when the product does not exist", async () => {
    service.getProduct.mockRejectedValue(new ApiError(404, "Product could not be found."));

    const res = await request(app).get(`/products/${ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Product could not be found." });
  });

  it("returns a 500 for unexpected service errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.getProduct.mockRejectedValue(new Error("boom"));

    const res = await request(app).get(`/products/${ID}`);

    expect(res.status).toBe(500);
  });

  it("returns a 500 when the service returns an invalid product", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.getProduct.mockResolvedValue({ ...product, price: -1 });

    const res = await request(app).get(`/products/${ID}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ message: "Something went wrong handling this request.", details: { endpoint: "getProduct" } });
  });
});

describe("POST /products", () => {
  it("requires a user", async () => {
    const res = await request(app).post("/products").send(productData);

    expect(res.status).toBe(401);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    const res = await request(app).post("/products").set(asRegularUser).send(productData);

    expect(res.status).toBe(403);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("creates the product and responds with a 201", async () => {
    const res = await request(app).post("/products").set(asAdmin).send(productData);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(product);
    expect(service.createProduct).toHaveBeenCalledWith(productData);
  });

  it.each([
    ["a missing field", { ...productData, title: undefined }],
    ["a short title", { ...productData, title: "ab" }],
    ["a non-integer price", { ...productData, price: 9.99 }],
    ["an unknown category", { ...productData, category: "Rupees" }],
    ["an unknown field", { ...productData, id: ID }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post("/products").set(asAdmin).send(body);

    expect(res.status).toBe(400);
    expect(service.createProduct).not.toHaveBeenCalled();
  });
});

describe("PUT /products/:id", () => {
  const update = { price: 100 };

  it("requires a user", async () => {
    const res = await request(app).put(`/products/${ID}`).send(update);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).put(`/products/${ID}`).set(asRegularUser).send(update);

    expect(res.status).toBe(403);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("updates the product", async () => {
    const res = await request(app).put(`/products/${ID}`).set(asAdmin).send(update);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.updateProduct).toHaveBeenCalledWith(ID, update);
  });

  it("rejects an empty update with a 400", async () => {
    const res = await request(app).put(`/products/${ID}`).set(asAdmin).send({});

    expect(res.status).toBe(400);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).put("/products/not-a-uuid").set(asAdmin).send(update);

    expect(res.status).toBe(400);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("returns a 404 when the product does not exist", async () => {
    service.updateProduct.mockRejectedValue(new ApiError(404, "Product could not be found."));

    const res = await request(app).put(`/products/${ID}`).set(asAdmin).send(update);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /products/:id", () => {
  it("requires a user", async () => {
    const res = await request(app).delete(`/products/${ID}`);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).delete(`/products/${ID}`).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.deleteProduct).not.toHaveBeenCalled();
  });

  it("deletes the product and responds with an empty 204", async () => {
    const res = await request(app).delete(`/products/${ID}`).set(asAdmin);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(service.deleteProduct).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).delete("/products/not-a-uuid").set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.deleteProduct).not.toHaveBeenCalled();
  });
});
