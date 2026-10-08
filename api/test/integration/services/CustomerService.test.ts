import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients";
import type { Address, CreateAddressBody, Customer } from "@mm/lib";

import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { CustomerService } from "@/services";
import type { User } from "@/types/user";
import { clearTable, putItems } from "../../helpers/db";

const { addresses: AddressesTable, customers: CustomersTable } = env.TABLE_NAMES;
const db = dbClient();

const addressData: Omit<CreateAddressBody, "setAsDefault"> = {
  street: "12 Lost Woods Path",
  city: "Kakariko",
  region: "Eldin",
  postalCode: "12345"
};

let customerId: string;

const makeService = (customerData: Omit<Customer, "id"> = {}) => {
  const user: User = {
    id: customerId,
    email: "link@hyrule.test",
    name: "Link",
    isAdmin: false,
    customerData
  };
  return new CustomerService(db, user);
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

beforeEach(async () => {
  customerId = crypto.randomUUID();
  await Promise.all([clearTable(db, AddressesTable, ["id"]), clearTable(db, CustomersTable, ["id"])]);
  await putItems(db, CustomersTable, [{ id: customerId }]);
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
      defaultAddress: null,
      defaultPaymentMethod: null
    });
  });

  it("includes the default address", async () => {
    const address = makeAddress();
    await putItems(db, AddressesTable, [address]);

    await expect(makeService({ defaultAddressId: address.id }).getCustomer()).resolves.toEqual({
      id: customerId,
      defaultAddress: toDto(address, true),
      defaultPaymentMethod: null
    });
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
      street: "1 Castle Way",
      city: "Castle Town",
      region: "Central Hyrule",
      postalCode: "54321"
    } as const;

    const updated = await makeService().updateAddress(address.id, changes);

    expect(updated).toEqual(toDto({ ...address, ...changes }));
    expect(await getRawAddress(address.id)).toEqual({ ...address, ...changes });
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
