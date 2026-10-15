import type { ListOrdersResponse, OrderDto } from "@mm/lib";
import request from "supertest";
import { container } from "tsyringe";

import type { IOrderService } from "@/contracts";
import { ORDER_SERVICE } from "@/contracts/tokens";
import { ApiError } from "@/errors/ApiError";
import api from "@/routes";
import { asAdmin, asRegularUser, createTestApp } from "../../helpers/testApp";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";
const CUSTOMER_ID = "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d";
const PRODUCT_ID = "5c8e2f1a-3b4d-4c6e-9a7b-8d1f2e3a4b5c";
const ORDER_DATE = "2026-10-01T12:00:00.000Z";

const order: OrderDto = {
  id: ID,
  customerId: CUSTOMER_ID,
  address: {
    recipient: "Link",
    street: "12 Lost Woods Path",
    city: "Kakariko",
    region: "Eldin",
    postalCode: "12345"
  },
  paymentMethod: { brand: "Hyrulian Express", lastFour: "4242" },
  orderDate: ORDER_DATE,
  currentStatus: "Placed",
  statusUpdates: { Placed: ORDER_DATE },
  products: { [PRODUCT_ID]: { amount: 2, pricePerUnit: 500 } },
  shipping: { method: "Express", cost: 40 }
};

const listResponse: ListOrdersResponse = {
  data: [{ id: ID, customerId: CUSTOMER_ID, orderDate: ORDER_DATE, currentStatus: "Placed", total: 1000 }],
  pagination: { hasNext: false, limit: 20 }
};

const orderBody = {
  id: ID,
  addressId: ID,
  paymentMethodId: ID,
  shippingMethod: "Express",
  items: { [PRODUCT_ID]: 2 },
  expectedTotal: 1040
};

const app = createTestApp(api);

let orderService: { [K in keyof IOrderService]: ReturnType<typeof vi.fn<IOrderService[K]>> };

beforeEach(() => {
  orderService = {
    cancelOrder: vi.fn<IOrderService["cancelOrder"]>().mockResolvedValue(),
    createOrder: vi.fn<IOrderService["createOrder"]>().mockResolvedValue(order),
    getOrder: vi.fn<IOrderService["getOrder"]>().mockResolvedValue(order),
    listOrders: vi.fn<IOrderService["listOrders"]>().mockResolvedValue(listResponse)
  };
  container.registerInstance(ORDER_SERVICE, orderService);
});

describe("authorization", () => {
  it.each([
    ["get", "/api/orders"],
    ["get", `/api/orders/${ID}`],
    ["post", "/api/orders"],
    ["put", `/api/orders/${ID}/cancel`]
  ] as const)("%s %s requires a user", async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/orders", () => {
  it("lists orders", async () => {
    const res = await request(app).get("/api/orders").set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listResponse);
  });

  it("passes parsed filters to the service", async () => {
    const res = await request(app)
      .get("/api/orders")
      .query({ customerId: CUSTOMER_ID, status: "Shipped", limit: "50" })
      .set(asAdmin);

    expect(res.status).toBe(200);
    expect(orderService.listOrders).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: CUSTOMER_ID, status: "Shipped", limit: 50 })
    );
  });

  it.each([
    ["an unknown status", { status: "Lost" }],
    ["an invalid customer id", { customerId: "nope" }]
  ])("rejects %s with a 400", async (_, query) => {
    const res = await request(app).get("/api/orders").query(query).set(asRegularUser);

    expect(res.status).toBe(400);
    expect(orderService.listOrders).not.toHaveBeenCalled();
  });
});

describe("GET /api/orders/:id", () => {
  it("returns the order", async () => {
    const res = await request(app).get(`/api/orders/${ID}`).set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(order);
    expect(orderService.getOrder).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).get("/api/orders/nope").set(asRegularUser);

    expect(res.status).toBe(400);
    expect(orderService.getOrder).not.toHaveBeenCalled();
  });

  it("passes through a 404 from the service", async () => {
    orderService.getOrder.mockRejectedValue(new ApiError(404, "Order not found."));

    const res = await request(app).get(`/api/orders/${ID}`).set(asRegularUser);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Order not found." });
  });
});

describe("POST /api/orders", () => {
  it("creates the order and responds with a 201", async () => {
    const res = await request(app).post("/api/orders").set(asRegularUser).send(orderBody);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(order);
    expect(orderService.createOrder).toHaveBeenCalledWith(orderBody);
  });

  it.each([
    ["a missing address id", { paymentMethodId: ID }],
    ["an invalid payment method id", { ...orderBody, paymentMethodId: "nope" }],
    ["a missing order id", { ...orderBody, id: undefined }],
    ["an unknown shipping method", { ...orderBody, shippingMethod: "Carrier Pigeon" }],
    ["a cart quantity of zero", { ...orderBody, items: { [PRODUCT_ID]: 0 } }],
    ["an unknown field", { ...orderBody, total: 1 }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post("/api/orders").set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(orderService.createOrder).not.toHaveBeenCalled();
  });

  it("passes through a 409 from the service", async () => {
    orderService.createOrder.mockRejectedValue(new ApiError(409, "Not enough stock."));

    const res = await request(app).post("/api/orders").set(asRegularUser).send(orderBody);

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/orders/:id/cancel", () => {
  it("cancels the order and responds with a 204", async () => {
    const res = await request(app).put(`/api/orders/${ID}/cancel`).set(asRegularUser);

    expect(res.status).toBe(204);
    expect(orderService.cancelOrder).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).put("/api/orders/nope/cancel").set(asRegularUser);

    expect(res.status).toBe(400);
    expect(orderService.cancelOrder).not.toHaveBeenCalled();
  });

  it("passes through a 409 from the service", async () => {
    orderService.cancelOrder.mockRejectedValue(new ApiError(409, "Order has already shipped."));

    const res = await request(app).put(`/api/orders/${ID}/cancel`).set(asRegularUser);

    expect(res.status).toBe(409);
  });
});
