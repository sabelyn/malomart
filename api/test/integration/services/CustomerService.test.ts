import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, s3Client } from "@mm/clients";
import type { Address, CreateAddressBody, Customer, PaymentMethodDto, Product } from "@mm/lib";
import { Category } from "@mm/lib";

import type { IPaymentMethodService } from "@/contracts";
import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { internal, notFound } from "@/errors/helpers";
import { CustomerService, ProductService } from "@/services";
import type { User } from "@/types/user";
import { putItems, track, trackWhere } from "../../helpers/db";

const {
  addresses: AddressesTable,
  carts: CartsTable,
  customers: CustomersTable,
  products: ProductsTable
} = env.TABLE_NAMES;
const db = dbClient();

const addressData: Omit<CreateAddressBody, "setAsDefault"> = {
  label: "Home",
  recipient: "Link",
  street: "12 Lost Woods Path",
  city: "Kakariko",
  region: "Eldin",
  postalCode: "12345"
};

let customerId: string;

const getPaymentMethod = vi.fn<IPaymentMethodService["getPaymentMethod"]>();
const listPaymentMethods = vi.fn<IPaymentMethodService["listPaymentMethods"]>();
const deletePaymentMethod = vi.fn<IPaymentMethodService["deletePaymentMethod"]>();
const paymentMethodService = {
  getPaymentMethod,
  listPaymentMethods,
  deletePaymentMethod
} as unknown as IPaymentMethodService;

const productService = new ProductService(db, s3Client());

const paymentMethodDto: PaymentMethodDto = {
  id: crypto.randomUUID(),
  brand: "Hyrulean Express",
  expirationMonth: 4,
  expirationYear: 2030,
  lastFour: "4242",
  isDefault: true
};

const makeService = (customerData: Omit<Customer, "id"> = {}) => {
  const user: User = {
    id: customerId,
    email: "link@hyrule.test",
    name: "Link",
    isAdmin: false,
    signInMethod: "email",
    customerData
  };
  return new CustomerService(db, paymentMethodService, productService, user);
};

const makeAddress = (overrides: Partial<Address> = {}): Address => ({
  id: crypto.randomUUID(),
  customerId,
  ...addressData,
  ...overrides
});

const toDto = ({ customerId: _, ...address }: Address, isDefault = false) => ({ ...address, isDefault });

const getRawAddress = async (id: string) =>
  (await db.send(new GetCommand({ TableName: AddressesTable, Key: { id } }))).Item;

const getRawCustomer = async (id: string) =>
  (await db.send(new GetCommand({ TableName: CustomersTable, Key: { id } }))).Item;

const getRawCart = async (id: string) =>
  (await db.send(new GetCommand({ TableName: CartsTable, Key: { customerId: id } }))).Item;

const putCart = (items: Record<string, number>) => putItems(db, CartsTable, [{ customerId, items }], ["customerId"]);

const putProducts = async (...stockCounts: number[]) => {
  const products: Product[] = stockCounts.map(stockCount => ({
    id: crypto.randomUUID(),
    title: "Mask of Truth",
    description: "Allows you to see into the minds of others.",
    category: Category.Masks,
    price: 80,
    stockCount,
    inStock: stockCount > 0 ? 1 : 0,
    features: []
  }));
  await putItems(db, ProductsTable, products);
  return products.map(p => p.id);
};

beforeEach(async () => {
  getPaymentMethod.mockReset();
  listPaymentMethods.mockReset().mockResolvedValue([]);
  deletePaymentMethod.mockReset().mockResolvedValue();
  customerId = crypto.randomUUID();
  await putItems(db, CustomersTable, [{ id: customerId }]);
});

afterEach(async () => {
  track(CartsTable, { customerId });
  await trackWhere(db, AddressesTable, "customerId", customerId);
});

describe("createAddress", () => {
  it("stores the address for the current customer and returns it", async () => {
    const created = await makeService().createAddress(addressData);

    expect(created).toEqual({ id: expect.any(String), ...addressData, isDefault: false });
    expect(await getRawAddress(created.id)).toEqual({ id: created.id, customerId, ...addressData });
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });

  it("generates a unique id for each address", async () => {
    const service = makeService();
    const first = await service.createAddress(addressData);
    const second = await service.createAddress(addressData);

    expect(first.id).not.toBe(second.id);
  });

  it("sets the address as the customer's default when requested", async () => {
    const created = await makeService().createAddress({ ...addressData, setAsDefault: true });

    expect(created.isDefault).toBe(true);
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultAddressId: created.id });
  });

  it("rejects when setting a default for a customer record that does not exist", async () => {
    customerId = crypto.randomUUID();

    await expect(makeService().createAddress({ ...addressData, setAsDefault: true })).rejects.toThrow();
    expect(await getRawCustomer(customerId)).toBeUndefined();
  });
});

describe("getAddress", () => {
  it("returns an address owned by the customer", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    await expect(makeService().getAddress(address.id)).resolves.toEqual(toDto(address));
  });

  it("marks the customer's default address", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    await expect(makeService({ defaultAddressId: address.id }).getAddress(address.id)).resolves.toEqual(
      toDto(address, true)
    );
  });

  it("throws a 404 when the address does not exist", async () => {
    const result = makeService().getAddress(crypto.randomUUID());

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 404 when the address belongs to another customer", async () => {
    const address = makeAddress({ customerId: crypto.randomUUID() });
    await putItems(db, AddressesTable, [address]);

    const result = makeService().getAddress(address.id);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 500 when the stored address is malformed", async () => {
    const address = makeAddress({ postalCode: "nope" });
    await putItems(db, AddressesTable, [address]);

    const result = makeService().getAddress(address.id);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("getCustomer", () => {
  it("returns the customer with no defaults", async () => {
    await expect(makeService().getCustomer()).resolves.toEqual({
      id: customerId,
      cart: {},
      defaultAddress: null,
      defaultPaymentMethod: null
    });
  });

  it("includes the saved cart", async () => {
    const [productId] = await putProducts(5);
    await putCart({ [productId]: 2 });

    await expect(makeService().getCustomer()).resolves.toMatchObject({ cart: { [productId]: 2 } });
  });

  it("includes the default address", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    await expect(makeService({ defaultAddressId: address.id }).getCustomer()).resolves.toEqual({
      id: customerId,
      cart: {},
      defaultAddress: toDto(address, true),
      defaultPaymentMethod: null
    });
  });

  it("includes the default payment method", async () => {
    getPaymentMethod.mockResolvedValue(paymentMethodDto);

    await expect(makeService({ defaultPaymentMethodId: paymentMethodDto.id }).getCustomer()).resolves.toEqual({
      id: customerId,
      cart: {},
      defaultAddress: null,
      defaultPaymentMethod: paymentMethodDto
    });
    expect(getPaymentMethod).toHaveBeenCalledWith(paymentMethodDto.id);
  });

  it("returns null for defaults that no longer exist", async () => {
    getPaymentMethod.mockRejectedValue(notFound("Payment method not found."));

    const service = makeService({ defaultAddressId: crypto.randomUUID(), defaultPaymentMethodId: crypto.randomUUID() });

    await expect(service.getCustomer()).resolves.toEqual({
      id: customerId,
      cart: {},
      defaultAddress: null,
      defaultPaymentMethod: null
    });
  });

  it("rethrows failures other than a missing default", async () => {
    getPaymentMethod.mockRejectedValue(internal(new Error("boom")));

    await expect(makeService({ defaultPaymentMethodId: crypto.randomUUID() }).getCustomer()).rejects.toMatchObject({
      statusCode: 500
    });
  });
});

describe("getCustomerCart", () => {
  it("returns an empty cart when the customer has none saved", async () => {
    await expect(makeService().getCustomerCart()).resolves.toEqual({});
  });

  it("returns the saved cart items", async () => {
    const [first, second] = await putProducts(5, 5);
    await putCart({ [first]: 1, [second]: 3 });

    await expect(makeService().getCustomerCart()).resolves.toEqual({ [first]: 1, [second]: 3 });
  });

  it("does not return another customer's cart", async () => {
    const [productId] = await putProducts(5);
    await putItems(db, CartsTable, [{ customerId: crypto.randomUUID(), items: { [productId]: 1 } }], ["customerId"]);

    await expect(makeService().getCustomerCart()).resolves.toEqual({});
  });
});

describe("updateCart", () => {
  it("saves the cart and reports no changes when everything is in stock", async () => {
    const [first, second] = await putProducts(5, 2);

    const changes = await makeService().updateCart({ [first]: 3, [second]: 2 });

    expect(changes).toEqual({});
    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [first]: 3, [second]: 2 } });
  });

  it("reduces quantities that exceed the available stock and reports them", async () => {
    const [plenty, scarce] = await putProducts(10, 2);

    const changes = await makeService().updateCart({ [plenty]: 4, [scarce]: 5 });

    expect(changes).toEqual({ [scarce]: 2 });
    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [plenty]: 4, [scarce]: 2 } });
  });

  it("removes sold-out items and reports them as 0", async () => {
    const [available, soldOut] = await putProducts(3, 0);

    const changes = await makeService().updateCart({ [available]: 1, [soldOut]: 2 });

    expect(changes).toEqual({ [soldOut]: 0 });
    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [available]: 1 } });
  });

  it("leaves a cart the customer can still read when every item is sold out", async () => {
    const [soldOut] = await putProducts(0);

    await makeService().updateCart({ [soldOut]: 1 });

    await expect(makeService().getCustomer()).resolves.toMatchObject({ cart: {} });
  });

  it("handles a single item", async () => {
    const [productId] = await putProducts(1);

    await expect(makeService().updateCart({ [productId]: 2 })).resolves.toEqual({ [productId]: 1 });
    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [productId]: 1 } });
  });

  it("replaces the previously saved cart", async () => {
    const [old, current] = await putProducts(5, 5);
    await putCart({ [old]: 2 });

    await makeService().updateCart({ [current]: 1 });

    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [current]: 1 } });
  });

  it("clears the cart when given no items", async () => {
    const [productId] = await putProducts(5);
    await putCart({ [productId]: 2 });

    await expect(makeService().updateCart({})).resolves.toEqual({});
    expect(await getRawCart(customerId)).toEqual({ customerId, items: {} });
  });

  it("removes and reports products that no longer exist", async () => {
    const [productId] = await putProducts(5);
    const missingId = crypto.randomUUID();

    await expect(makeService().updateCart({ [productId]: 1, [missingId]: 2 })).resolves.toEqual({ [missingId]: 0 });
    expect(await getRawCart(customerId)).toEqual({ customerId, items: { [productId]: 1 } });
  });
});

describe("listAddresses", () => {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

  it("returns an empty list when the customer has no addresses", async () => {
    await expect(makeService().listAddresses()).resolves.toEqual([]);
  });

  it("returns only the customer's addresses", async () => {
    const own = [makeAddress(), makeAddress({ city: "Hateno", region: "Necluda" })];
    await putItems(db, AddressesTable, [...own, makeAddress({ customerId: crypto.randomUUID() })]);

    const result = await makeService({ defaultAddressId: own[1].id }).listAddresses();

    expect(result.toSorted(byId)).toEqual([toDto(own[0]), toDto(own[1], true)].toSorted(byId));
  });
});

describe("updateAddress", () => {
  it("updates only the provided fields", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    const updated = await makeService().updateAddress(address.id, { city: "Hateno" });

    expect(updated).toEqual(toDto({ ...address, city: "Hateno" }));
    expect(await getRawAddress(address.id)).toEqual({ ...address, city: "Hateno" });
  });

  it("updates every address field at once", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);
    const changes = {
      label: "Castle",
      recipient: "Zelda",
      street: "1 Castle Way",
      city: "Castle Town",
      region: "Central Hyrule",
      postalCode: "54321"
    } as const;

    const updated = await makeService().updateAddress(address.id, changes);

    expect(updated).toEqual(toDto({ ...address, ...changes }));
    expect(await getRawAddress(address.id)).toEqual({ ...address, ...changes });
  });

  it("removes the label when it is null", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);
    const { label: _, ...unlabeled } = address;

    const updated = await makeService().updateAddress(address.id, { label: null, city: "Hateno" });

    expect(updated).toEqual(toDto({ ...unlabeled, city: "Hateno" }));
    expect(await getRawAddress(address.id)).toEqual({ ...unlabeled, city: "Hateno" });
  });

  it("removes the label without other changes", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);
    const { label: _, ...unlabeled } = address;

    const updated = await makeService().updateAddress(address.id, { label: null });

    expect(updated).toEqual(toDto(unlabeled));
    expect(await getRawAddress(address.id)).toEqual(unlabeled);
  });

  it("sets the address as the default without changing other fields", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    const updated = await makeService().updateAddress(address.id, { setAsDefault: true });

    expect(updated).toEqual(toDto(address, true));
    expect(await getRawAddress(address.id)).toEqual(address);
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultAddressId: address.id });
  });

  it("updates fields and sets the default together", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    const updated = await makeService().updateAddress(address.id, { street: "1 Castle Way", setAsDefault: true });

    expect(updated).toEqual(toDto({ ...address, street: "1 Castle Way" }, true));
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultAddressId: address.id });
  });

  it("does not create the address when it does not exist", async () => {
    const id = crypto.randomUUID();

    await expect(makeService().updateAddress(id, { city: "Hateno" })).rejects.toMatchObject({ statusCode: 404 });
    expect(await getRawAddress(id)).toBeUndefined();
  });

  it("does not modify an address belonging to another customer", async () => {
    const address = makeAddress({ customerId: crypto.randomUUID() });
    await putItems(db, AddressesTable, [address]);

    await expect(makeService().updateAddress(address.id, { city: "Hateno" })).rejects.toMatchObject({
      statusCode: 404
    });
    expect(await getRawAddress(address.id)).toEqual(address);
  });

  it("does not set another customer's address as the default", async () => {
    const address = makeAddress({ customerId: crypto.randomUUID() });
    await putItems(db, AddressesTable, [address]);

    await expect(makeService().updateAddress(address.id, { setAsDefault: true })).rejects.toMatchObject({
      statusCode: 404
    });
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });
});

describe("deleteAddress", () => {
  it("removes the customer's address", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    await makeService().deleteAddress(address.id);

    expect(await getRawAddress(address.id)).toBeUndefined();
  });

  it("clears the customer's default when deleting the default address", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);
    await putItems(db, CustomersTable, [{ id: customerId, defaultAddressId: address.id }]);

    await makeService({ defaultAddressId: address.id }).deleteAddress(address.id);

    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultAddressId: null });
  });

  it("does not remove an address belonging to another customer", async () => {
    const address = makeAddress({ customerId: crypto.randomUUID() });
    await putItems(db, AddressesTable, [address]);

    await expect(makeService().deleteAddress(address.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(await getRawAddress(address.id)).toEqual(address);
  });

  it("throws a 404 when the address does not exist", async () => {
    await expect(makeService().deleteAddress(crypto.randomUUID())).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe("deleteSavedData", () => {
  it("deletes the customer's addresses and payment methods", async () => {
    const own = [makeAddress(), makeAddress()];
    const other = makeAddress({ customerId: crypto.randomUUID() });
    await putItems(db, AddressesTable, [...own, other]);
    listPaymentMethods.mockResolvedValue([paymentMethodDto]);

    await makeService({ defaultAddressId: own[0].id }).deleteSavedData();

    expect(await getRawAddress(own[0].id)).toBeUndefined();
    expect(await getRawAddress(own[1].id)).toBeUndefined();
    expect(await getRawAddress(other.id)).toEqual(other);
    expect(deletePaymentMethod).toHaveBeenCalledWith(paymentMethodDto.id);
  });

  it("does nothing when there is no saved data", async () => {
    await makeService().deleteSavedData();

    expect(deletePaymentMethod).not.toHaveBeenCalled();
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });
});

describe("deleteCustomerRecord", () => {
  it("deletes the customer record", async () => {
    await makeService().deleteCustomerRecord();

    expect(await getRawCustomer(customerId)).toBeUndefined();
  });
});
