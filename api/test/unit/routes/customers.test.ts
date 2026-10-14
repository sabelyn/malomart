import type { AddressDto, CustomerDto, PaymentMethodDto } from "@mm/lib";
import request from "supertest";
import { container } from "tsyringe";

import type { ICustomerService, IPaymentMethodService } from "@/contracts";
import { CUSTOMER_SERVICE, PAYMENT_METHOD_SERVICE } from "@/contracts/tokens";
import { ApiError } from "@/errors/ApiError";
import api from "@/routes";
import { asRegularUser, createTestApp } from "../../helpers/testApp";

const ID = "3f2a9c1e-7b4d-4e8a-9f6b-2c1d0e5a7b3c";

const addressData = {
  label: "Home",
  recipient: "Link",
  street: "12 Lost Woods Path",
  city: "Kakariko",
  region: "Eldin",
  postalCode: "12345"
} as const;

const address: AddressDto = { id: ID, ...addressData, isDefault: false };

const paymentMethod: PaymentMethodDto = {
  id: ID,
  brand: "Hyrulian Express",
  expirationMonth: 4,
  expirationYear: 2030,
  lastFour: "4242",
  isDefault: false
};

const customer: CustomerDto = {
  id: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  defaultAddress: address,
  defaultPaymentMethod: null,
  cart: {}
};

const app = createTestApp(api);

let customerService: { [K in keyof ICustomerService]: ReturnType<typeof vi.fn<ICustomerService[K]>> };
let paymentMethodService: { [K in keyof IPaymentMethodService]: ReturnType<typeof vi.fn<IPaymentMethodService[K]>> };

beforeEach(() => {
  customerService = {
    createAddress: vi.fn<ICustomerService["createAddress"]>().mockResolvedValue(address),
    deleteAddress: vi.fn<ICustomerService["deleteAddress"]>().mockResolvedValue(),
    deleteCustomerRecord: vi.fn<ICustomerService["deleteCustomerRecord"]>().mockResolvedValue(),
    deleteSavedData: vi.fn<ICustomerService["deleteSavedData"]>().mockResolvedValue(),
    getAddress: vi.fn<ICustomerService["getAddress"]>().mockResolvedValue(address),
    getCustomer: vi.fn<ICustomerService["getCustomer"]>().mockResolvedValue(customer),
    getCustomerCart: vi.fn<ICustomerService["getCustomerCart"]>().mockResolvedValue({}),
    listAddresses: vi.fn<ICustomerService["listAddresses"]>().mockResolvedValue([address]),
    updateAddress: vi.fn<ICustomerService["updateAddress"]>().mockResolvedValue(address),
    updateCart: vi.fn<ICustomerService["updateCart"]>().mockResolvedValue({})
  };
  paymentMethodService = {
    createPaymentMethod: vi.fn<IPaymentMethodService["createPaymentMethod"]>().mockResolvedValue(paymentMethod),
    deletePaymentMethod: vi.fn<IPaymentMethodService["deletePaymentMethod"]>().mockResolvedValue(),
    getPaymentMethod: vi.fn<IPaymentMethodService["getPaymentMethod"]>().mockResolvedValue(paymentMethod),
    getPaymentMethodWithToken: vi
      .fn<IPaymentMethodService["getPaymentMethodWithToken"]>()
      .mockResolvedValue({ ...paymentMethod, token: "tok" }),
    listPaymentMethods: vi.fn<IPaymentMethodService["listPaymentMethods"]>().mockResolvedValue([paymentMethod]),
    updatePaymentMethod: vi.fn<IPaymentMethodService["updatePaymentMethod"]>().mockResolvedValue(paymentMethod)
  };
  container.registerInstance(CUSTOMER_SERVICE, customerService);
  container.registerInstance(PAYMENT_METHOD_SERVICE, paymentMethodService);
});

describe("authorization", () => {
  it.each([
    ["get", "/api/customers"],
    ["get", "/api/customers/addresses"],
    ["post", "/api/customers/addresses"],
    ["put", `/api/customers/addresses/${ID}`],
    ["delete", `/api/customers/addresses/${ID}`],
    ["get", "/api/customers/payment-methods"],
    ["post", "/api/customers/payment-methods"],
    ["put", `/api/customers/payment-methods/${ID}`],
    ["delete", `/api/customers/payment-methods/${ID}`],
    ["put", "/api/customers/cart"]
  ] as const)("%s %s requires a user", async (method, path) => {
    const res = await request(app)[method](path);

    expect(res.status).toBe(401);
  });
});

describe("GET /api/customers", () => {
  it("returns the current customer", async () => {
    const res = await request(app).get("/api/customers").set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(customer);
  });

  it("returns a 500 when the service returns an invalid customer", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    customerService.getCustomer.mockResolvedValue({ ...customer, id: "" });

    const res = await request(app).get("/api/customers").set(asRegularUser);

    expect(res.status).toBe(500);
    expect(res.body.details).toEqual({ endpoint: "getCustomer" });
  });
});

describe("GET /api/customers/addresses", () => {
  it("lists the customer's addresses", async () => {
    const res = await request(app).get("/api/customers/addresses").set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([address]);
  });
});

describe("POST /api/customers/addresses", () => {
  it("creates the address and responds with a 201", async () => {
    const body = { ...addressData, setAsDefault: true };

    const res = await request(app).post("/api/customers/addresses").set(asRegularUser).send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(address);
    expect(customerService.createAddress).toHaveBeenCalledWith(body);
  });

  it("accepts an address without a label", async () => {
    const { label: _, ...body } = addressData;

    const res = await request(app).post("/api/customers/addresses").set(asRegularUser).send(body);

    expect(res.status).toBe(201);
    expect(customerService.createAddress).toHaveBeenCalledWith(body);
  });

  it.each([
    ["a missing recipient", { ...addressData, recipient: undefined }],
    ["a blank recipient", { ...addressData, recipient: "   " }],
    ["a blank label", { ...addressData, label: "" }],
    ["an invalid postal code", { ...addressData, postalCode: "1234" }],
    ["an unknown region", { ...addressData, region: "Termina" }],
    ["an unknown field", { ...addressData, id: ID }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post("/api/customers/addresses").set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(customerService.createAddress).not.toHaveBeenCalled();
  });
});

describe("PUT /api/customers/addresses/:id", () => {
  it("updates the address", async () => {
    const res = await request(app).put(`/api/customers/addresses/${ID}`).set(asRegularUser).send({ city: "Hateno" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(address);
    expect(customerService.updateAddress).toHaveBeenCalledWith(ID, { city: "Hateno" });
  });

  it("accepts a null label to clear it", async () => {
    await request(app).put(`/api/customers/addresses/${ID}`).set(asRegularUser).send({ label: null });

    expect(customerService.updateAddress).toHaveBeenCalledWith(ID, { label: null });
  });

  it.each([
    ["an empty body", {}],
    ["a null recipient", { recipient: null }],
    ["an invalid postal code", { postalCode: "abcde" }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).put(`/api/customers/addresses/${ID}`).set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(customerService.updateAddress).not.toHaveBeenCalled();
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).put("/api/customers/addresses/nope").set(asRegularUser).send({ city: "Hateno" });

    expect(res.status).toBe(400);
    expect(customerService.updateAddress).not.toHaveBeenCalled();
  });

  it("passes through a 404 from the service", async () => {
    customerService.updateAddress.mockRejectedValue(new ApiError(404, "Address could not be found."));

    const res = await request(app).put(`/api/customers/addresses/${ID}`).set(asRegularUser).send({ city: "Hateno" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Address could not be found." });
  });
});

describe("DELETE /api/customers/addresses/:id", () => {
  it("deletes the address and responds with a 204", async () => {
    const res = await request(app).delete(`/api/customers/addresses/${ID}`).set(asRegularUser);

    expect(res.status).toBe(204);
    expect(customerService.deleteAddress).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).delete("/api/customers/addresses/nope").set(asRegularUser);

    expect(res.status).toBe(400);
    expect(customerService.deleteAddress).not.toHaveBeenCalled();
  });
});

describe("GET /api/customers/payment-methods", () => {
  it("lists the customer's payment methods", async () => {
    const res = await request(app).get("/api/customers/payment-methods").set(asRegularUser);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([paymentMethod]);
  });
});

describe("POST /api/customers/payment-methods", () => {
  it("creates the payment method and responds with a 201", async () => {
    const body = { token: "tok_123", setAsDefault: true };

    const res = await request(app).post("/api/customers/payment-methods").set(asRegularUser).send(body);

    expect(res.status).toBe(201);
    expect(res.body).toEqual(paymentMethod);
    expect(paymentMethodService.createPaymentMethod).toHaveBeenCalledWith(body);
  });

  it.each([
    ["a missing token", {}],
    ["an empty token", { token: "" }],
    ["raw card details", { token: "tok_123", cardNumber: "4242424242424242" }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).post("/api/customers/payment-methods").set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(paymentMethodService.createPaymentMethod).not.toHaveBeenCalled();
  });

  it("passes through a 409 from the service", async () => {
    paymentMethodService.createPaymentMethod.mockRejectedValue(new ApiError(409, "Token already in use."));

    const res = await request(app).post("/api/customers/payment-methods").set(asRegularUser).send({ token: "tok_123" });

    expect(res.status).toBe(409);
  });
});

describe("PUT /api/customers/payment-methods/:id", () => {
  it("updates the expiration", async () => {
    const body = { expiration: { expirationMonth: 0, expirationYear: 2031 } };

    const res = await request(app).put(`/api/customers/payment-methods/${ID}`).set(asRegularUser).send(body);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(paymentMethod);
    expect(paymentMethodService.updatePaymentMethod).toHaveBeenCalledWith(ID, body);
  });

  it.each([
    ["an empty body", {}],
    ["setAsDefault false", { setAsDefault: false }],
    ["an out-of-range month", { expiration: { expirationMonth: 12, expirationYear: 2031 } }],
    ["a brand change", { brand: "Castle One" }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).put(`/api/customers/payment-methods/${ID}`).set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(paymentMethodService.updatePaymentMethod).not.toHaveBeenCalled();
  });

  it("passes through a 404 from the service", async () => {
    paymentMethodService.updatePaymentMethod.mockRejectedValue(new ApiError(404, "Payment method not found."));

    const res = await request(app)
      .put(`/api/customers/payment-methods/${ID}`)
      .set(asRegularUser)
      .send({ setAsDefault: true });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ message: "Payment method not found." });
  });
});

describe("DELETE /api/customers/payment-methods/:id", () => {
  it("deletes the payment method and responds with a 204", async () => {
    const res = await request(app).delete(`/api/customers/payment-methods/${ID}`).set(asRegularUser);

    expect(res.status).toBe(204);
    expect(paymentMethodService.deletePaymentMethod).toHaveBeenCalledWith(ID);
  });

  it("rejects an invalid id with a 400", async () => {
    const res = await request(app).delete("/api/customers/payment-methods/nope").set(asRegularUser);

    expect(res.status).toBe(400);
    expect(paymentMethodService.deletePaymentMethod).not.toHaveBeenCalled();
  });
});

describe("PUT /api/customers/cart", () => {
  it("updates the cart and returns any reduced quantities", async () => {
    customerService.updateCart.mockResolvedValue({ [ID]: 1 });

    const res = await request(app)
      .put("/api/customers/cart")
      .set(asRegularUser)
      .send({ [ID]: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ [ID]: 1 });
    expect(customerService.updateCart).toHaveBeenCalledWith({ [ID]: 3 });
  });

  it("accepts an empty cart", async () => {
    const res = await request(app).put("/api/customers/cart").set(asRegularUser).send({});

    expect(res.status).toBe(200);
    expect(customerService.updateCart).toHaveBeenCalledWith({});
  });

  it.each([
    ["a non-UUID product id", { nope: 1 }],
    ["a zero quantity", { [ID]: 0 }],
    ["a fractional quantity", { [ID]: 1.5 }]
  ])("rejects %s with a 400", async (_, body) => {
    const res = await request(app).put("/api/customers/cart").set(asRegularUser).send(body);

    expect(res.status).toBe(400);
    expect(customerService.updateCart).not.toHaveBeenCalled();
  });

});
