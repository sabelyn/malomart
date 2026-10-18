import type { ImageUploadDto, ImageUploadPostResponse, ListProductsResponse, ProductDto } from "@mm/lib";
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
  stockCount: 2,
  features: ["Reveals hidden truths"]
};

const productData = {
  title: product.title,
  description: product.description,
  category: product.category,
  price: product.price,
  stockCount: product.stockCount,
  features: product.features
};

const listResult: ListProductsResponse = {
  data: [
    {
      id: ID,
      title: product.title,
      category: product.category,
      price: product.price,
      stockCount: product.stockCount
    }
  ],
  pagination: { hasNext: false, limit: 20 }
};

const UPLOAD_ID = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

const uploadPost: ImageUploadPostResponse = {
  url: "https://upload-staging.s3.us-east-1.amazonaws.com/",
  fields: { key: `products/${ID}/${UPLOAD_ID}`, "Content-Type": "image/png" },
  uploadId: UPLOAD_ID
};

const upload: ImageUploadDto = { id: UPLOAD_ID, status: "Ready", imageKey: `products/${ID}/0123456789abcdef` };

const IMAGE_KEY = "0123456789abcdef";

const app = createTestApp(api);

let service: { [K in keyof IProductService]: ReturnType<typeof vi.fn<IProductService[K]>> };

beforeEach(() => {
  service = {
    adjustStock: vi.fn<IProductService["adjustStock"]>().mockResolvedValue(product),
    createProduct: vi.fn<IProductService["createProduct"]>().mockResolvedValue(product),
    deleteProduct: vi.fn<IProductService["deleteProduct"]>().mockResolvedValue(),
    deleteProductImage: vi.fn<IProductService["deleteProductImage"]>().mockResolvedValue(product),
    getImageUpload: vi.fn<IProductService["getImageUpload"]>().mockResolvedValue(upload),
    getProduct: vi.fn<IProductService["getProduct"]>().mockResolvedValue(product),
    getProductImageUploadPost: vi.fn<IProductService["getProductImageUploadPost"]>().mockResolvedValue(uploadPost),
    getProducts: vi.fn<IProductService["getProducts"]>().mockResolvedValue(listResult.data),
    getProductStocks: vi.fn<IProductService["getProductStocks"]>().mockResolvedValue({ [ID]: product.stockCount }),
    listProducts: vi.fn<IProductService["listProducts"]>().mockResolvedValue(listResult),
    setImageAsThumbnail: vi.fn<IProductService["setImageAsThumbnail"]>().mockResolvedValue(product),
    updateProduct: vi.fn<IProductService["updateProduct"]>().mockResolvedValue(product)
  };
  container.registerInstance(PRODUCT_SERVICE, service);
});

describe("GET /api/products", () => {
  it("lists products with default pagination", async () => {
    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listResult);
    expect(service.listProducts).toHaveBeenCalledWith({ limit: 20 });
  });

  it("parses query parameters", async () => {
    await request(app).get("/api/products").query({ limit: "50", category: "Weapons", inStock: "true", cursor: "abc" });

    expect(service.listProducts).toHaveBeenCalledWith({ limit: 50, category: "Weapons", inStock: true, cursor: "abc" });
  });

  it("passes an inStock of false through for out-of-stock filtering", async () => {
    await request(app).get("/api/products").query({ inStock: "false" });

    expect(service.listProducts).toHaveBeenCalledWith({ limit: 20, inStock: false });
  });

  it.each([
    ["a limit below the minimum", { limit: "5" }],
    ["a non-numeric limit", { limit: "lots" }],
    ["an unknown category", { category: "Rupees" }],
    ["a non-boolean inStock", { inStock: "maybe" }]
  ])("rejects %s with a 400", async (_, query) => {
    const res = await request(app).get("/api/products").query(query);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Request validation failed.");
    expect(res.body.details).toBeDefined();
    expect(service.listProducts).not.toHaveBeenCalled();
  });

  it("passes through service errors", async () => {
    service.listProducts.mockRejectedValue(new ApiError(400, "Invalid cursor."));

    const res = await request(app).get("/api/products").query({ cursor: "bad" });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: "Invalid cursor." });
  });
});

describe("GET /api/products/batch", () => {
  const OTHER_ID = "8c1e2d3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

  it("returns the requested products without requiring auth", async () => {
    const res = await request(app)
      .get("/api/products/batch")
      .query({ ids: `${ID},${OTHER_ID}` });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listResult.data);
    expect(service.getProducts).toHaveBeenCalledWith([ID, OTHER_ID]);
    expect(service.getProduct).not.toHaveBeenCalled();
  });

  it.each([
    ["no ids", {}],
    ["an invalid id", { ids: `${ID},not-a-uuid` }],
    ["too many ids", { ids: Array.from({ length: 101 }, () => ID).join(",") }]
  ])("rejects %s with a 400", async (_, query) => {
    const res = await request(app).get("/api/products/batch").query(query);

    expect(res.status).toBe(400);
    expect(service.getProducts).not.toHaveBeenCalled();
  });
});

describe("GET /api/products/:id", () => {
  it("returns the product without requiring auth", async () => {
    const res = await request(app).get(`/api/products/${ID}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.getProduct).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).get("/api/products/not-a-uuid");

    expect(res.status).toBe(400);
    expect(service.getProduct).not.toHaveBeenCalled();
  });

  it("returns a 404 when the product does not exist", async () => {
    service.getProduct.mockRejectedValue(new ApiError(404, "Product could not be found."));

    const res = await request(app).get(`/api/products/${ID}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Product could not be found." });
  });

  it("returns a 500 for unexpected service errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.getProduct.mockRejectedValue(new Error("boom"));

    const res = await request(app).get(`/api/products/${ID}`);

    expect(res.status).toBe(500);
  });

  it("returns a 500 when the service returns an invalid product", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    service.getProduct.mockResolvedValue({ ...product, price: -1 });

    const res = await request(app).get(`/api/products/${ID}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({
      message: "Something went wrong handling this request.",
      details: { endpoint: "getProduct" }
    });
  });
});

describe("POST /api/products", () => {
  it("requires a user", async () => {
    const res = await request(app).post("/api/products").send(productData);

    expect(res.status).toBe(401);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("requires an admin", async () => {
    const res = await request(app).post("/api/products").set(asRegularUser).send(productData);

    expect(res.status).toBe(403);
    expect(service.createProduct).not.toHaveBeenCalled();
  });

  it("creates the product and responds with a 201", async () => {
    const res = await request(app).post("/api/products").set(asAdmin).send(productData);

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
    const res = await request(app).post("/api/products").set(asAdmin).send(body);

    expect(res.status).toBe(400);
    expect(service.createProduct).not.toHaveBeenCalled();
  });
});

describe("PUT /api/products/:id", () => {
  const update = { price: 100 };

  it("requires a user", async () => {
    const res = await request(app).put(`/api/products/${ID}`).send(update);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).put(`/api/products/${ID}`).set(asRegularUser).send(update);

    expect(res.status).toBe(403);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("updates the product", async () => {
    const res = await request(app).put(`/api/products/${ID}`).set(asAdmin).send(update);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.updateProduct).toHaveBeenCalledWith(ID, update);
  });

  it("rejects an empty update with a 400", async () => {
    const res = await request(app).put(`/api/products/${ID}`).set(asAdmin).send({});

    expect(res.status).toBe(400);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).put("/api/products/not-a-uuid").set(asAdmin).send(update);

    expect(res.status).toBe(400);
    expect(service.updateProduct).not.toHaveBeenCalled();
  });

  it("returns a 404 when the product does not exist", async () => {
    service.updateProduct.mockRejectedValue(new ApiError(404, "Product could not be found."));

    const res = await request(app).put(`/api/products/${ID}`).set(asAdmin).send(update);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/products/:id", () => {
  it("requires a user", async () => {
    const res = await request(app).delete(`/api/products/${ID}`);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).delete(`/api/products/${ID}`).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.deleteProduct).not.toHaveBeenCalled();
  });

  it("deletes the product and responds with an empty 204", async () => {
    const res = await request(app).delete(`/api/products/${ID}`).set(asAdmin);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(service.deleteProduct).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).delete("/api/products/not-a-uuid").set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.deleteProduct).not.toHaveBeenCalled();
  });
});

describe("POST /api/products/:id/images", () => {
  const path = `/api/products/${ID}/images`;

  it("requires a user", async () => {
    const res = await request(app).post(path).query({ contentType: "image/png" });

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).post(path).query({ contentType: "image/png" }).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.getProductImageUploadPost).not.toHaveBeenCalled();
  });

  it("responds with the presigned post", async () => {
    const res = await request(app).post(path).query({ contentType: "image/png" }).set(asAdmin);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(uploadPost);
    expect(service.getProductImageUploadPost).toHaveBeenCalledWith(ID, "image/png");
  });

  it.each([
    ["a missing content type", {}],
    ["a non-image content type", { contentType: "application/pdf" }]
  ])("rejects %s with a 400", async (_, query) => {
    const res = await request(app).post(path).query(query).set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.getProductImageUploadPost).not.toHaveBeenCalled();
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app)
      .post("/api/products/not-a-uuid/images")
      .query({ contentType: "image/png" })
      .set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.getProductImageUploadPost).not.toHaveBeenCalled();
  });
});

describe("POST /api/products/:id/stock", () => {
  const path = `/api/products/${ID}/stock`;

  it("requires a user", async () => {
    const res = await request(app).post(path).send({ change: 5 });

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).post(path).set(asRegularUser).send({ change: 5 });

    expect(res.status).toBe(403);
    expect(service.adjustStock).not.toHaveBeenCalled();
  });

  it.each([5, -2])("applies a change of %i and responds with the product", async change => {
    const res = await request(app).post(path).set(asAdmin).send({ change });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.adjustStock).toHaveBeenCalledWith(ID, change);
  });

  it.each([
    ["a zero change", { change: 0 }],
    ["a fractional change", { change: 1.5 }],
    ["a change that is too large", { change: 10_001 }],
    ["a missing change", {}],
    ["an unknown field", { change: 1, productId: ID }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post(path).set(asAdmin).send(body);

    expect(res.status).toBe(400);
    expect(service.adjustStock).not.toHaveBeenCalled();
  });

  it("returns a 409 when there isn't enough stock to remove", async () => {
    service.adjustStock.mockRejectedValue(new ApiError(409, "Can't remove 5 when only 2 in stock."));

    const res = await request(app).post(path).set(asAdmin).send({ change: -5 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ message: "Can't remove 5 when only 2 in stock." });
  });
});

describe("GET /api/products/:id/uploads/:uploadId", () => {
  const path = `/api/products/${ID}/uploads/${UPLOAD_ID}`;

  it("requires a user", async () => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).get(path).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.getImageUpload).not.toHaveBeenCalled();
  });

  it("responds with the upload status", async () => {
    const res = await request(app).get(path).set(asAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(upload);
    expect(service.getImageUpload).toHaveBeenCalledWith(ID, UPLOAD_ID);
  });

  it("rejects an invalid upload id with a 400", async () => {
    const res = await request(app).get(`/api/products/${ID}/uploads/not-a-uuid`).set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.getImageUpload).not.toHaveBeenCalled();
  });

  it("returns a 404 when the upload does not exist", async () => {
    service.getImageUpload.mockRejectedValue(new ApiError(404, "Upload could not be found."));

    const res = await request(app).get(path).set(asAdmin);

    expect(res.status).toBe(404);
  });
});

describe("PUT /api/products/:id/images/:key", () => {
  const path = `/api/products/${ID}/images/${IMAGE_KEY}`;

  it("requires a user", async () => {
    const res = await request(app).put(path);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).put(path).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.setImageAsThumbnail).not.toHaveBeenCalled();
  });

  it("sets the thumbnail and responds with the product", async () => {
    const res = await request(app).put(path).set(asAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.setImageAsThumbnail).toHaveBeenCalledWith(ID, IMAGE_KEY);
  });

  it("returns a 404 when the product image does not exist", async () => {
    service.setImageAsThumbnail.mockRejectedValue(new ApiError(404, "Product image could not be found."));

    const res = await request(app).put(path).set(asAdmin);

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/products/:id/images/:key", () => {
  const path = `/api/products/${ID}/images/${IMAGE_KEY}`;

  it("requires a user", async () => {
    const res = await request(app).delete(path);

    expect(res.status).toBe(401);
  });

  it("requires an admin", async () => {
    const res = await request(app).delete(path).set(asRegularUser);

    expect(res.status).toBe(403);
    expect(service.deleteProductImage).not.toHaveBeenCalled();
  });

  it("deletes the image and responds with the product", async () => {
    const res = await request(app).delete(path).set(asAdmin);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(product);
    expect(service.deleteProductImage).toHaveBeenCalledWith(ID, IMAGE_KEY);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).delete(`/api/products/not-a-uuid/images/${IMAGE_KEY}`).set(asAdmin);

    expect(res.status).toBe(400);
    expect(service.deleteProductImage).not.toHaveBeenCalled();
  });
});
