import { DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, lambdaClient } from "@mm/clients";
import type { Customer, PaymentMethod } from "@mm/lib";
import type { VaultCard } from "@mm/lib/lambdas";

import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { PaymentMethodService } from "@/services";
import type { User } from "@/types/user";
import { clearTable, putItems } from "../../helpers/db";

const { customers: CustomersTable, paymentMethods: PaymentMethodsTable } = env.TABLE_NAMES;
const { VAULT_CARD_TABLE_NAME } = process.env;
const db = dbClient();
const lambda = lambdaClient();

const ASYNC_TIMEOUT = 20_000;
const waitForVault = { timeout: ASYNC_TIMEOUT, interval: 500 };

const metadata = { brand: "visa", expirationMonth: 4, expirationYear: 2030, lastFour: "4242" };

let customerId: string;
let vaultTokens: string[];

const makeService = (customerData: Omit<Customer, "id"> = {}) => {
  const user: User = {
    id: customerId,
    email: "link@hyrule.test",
    name: "Link",
    isAdmin: false,
    customerData
  };
  return new PaymentMethodService(db, lambda, user);
};

const putVaultCard = async (overrides: Partial<VaultCard> = {}) => {
  const card: VaultCard = {
    token: crypto.randomUUID(),
    customerId,
    cypher: new Uint8Array([1, 2, 3]),
    ...metadata,
    ...overrides
  };
  vaultTokens.push(card.token);
  await db.send(new PutCommand({ TableName: VAULT_CARD_TABLE_NAME, Item: card }));
  return card;
};

const makePaymentMethod = (overrides: Partial<PaymentMethod> = {}): PaymentMethod => ({
  id: crypto.randomUUID(),
  customerId,
  token: crypto.randomUUID(),
  ...metadata,
  ...overrides
});

const toDto = ({ customerId: _, token: __, ...method }: PaymentMethod, isDefault = false) => ({
  ...method,
  isDefault
});

const getRawPaymentMethod = async (id: string) =>
  (await db.send(new GetCommand({ TableName: PaymentMethodsTable, Key: { id } }))).Item;

const getRawCustomer = async (id: string) =>
  (await db.send(new GetCommand({ TableName: CustomersTable, Key: { id } }))).Item;

const getRawVaultCard = async (token: string) =>
  (await db.send(new GetCommand({ TableName: VAULT_CARD_TABLE_NAME, Key: { token } }))).Item as
    | VaultCard
    | undefined;

beforeEach(async () => {
  customerId = crypto.randomUUID();
  vaultTokens = [];
  await Promise.all([clearTable(db, PaymentMethodsTable, ["id"]), clearTable(db, CustomersTable, ["id"])]);
  await putItems(db, CustomersTable, [{ id: customerId }]);
});

afterEach(async () => {
  await Promise.all(
    vaultTokens.map(token => db.send(new DeleteCommand({ TableName: VAULT_CARD_TABLE_NAME, Key: { token } })))
  );
});

describe("createPaymentMethod", () => {
  it("stores the vault card's metadata for the current customer and returns it", async () => {
    const { token } = await putVaultCard();

    const created = await makeService().createPaymentMethod({ token });

    expect(created).toEqual({ id: expect.any(String), ...metadata, isDefault: false });
    expect(await getRawPaymentMethod(created.id)).toEqual({ id: created.id, customerId, token, ...metadata });
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });

  it("sets the payment method as the customer's default when requested", async () => {
    const { token } = await putVaultCard();

    const created = await makeService().createPaymentMethod({ token, setAsDefault: true });

    expect(created.isDefault).toBe(true);
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultPaymentMethodId: created.id });
  });

  it("throws a 409 when the customer already has a payment method with the token", async () => {
    const { token } = await putVaultCard();
    const existing = makePaymentMethod({ token });
    await putItems(db, PaymentMethodsTable, [existing]);

    const result = makeService().createPaymentMethod({ token });

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws a 404 when the token does not exist in the vault", async () => {
    const result = makeService().createPaymentMethod({ token: crypto.randomUUID() });

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 404 and stores nothing when the vault card belongs to another customer", async () => {
    const { token } = await putVaultCard({ customerId: crypto.randomUUID() });

    await expect(makeService().createPaymentMethod({ token })).rejects.toMatchObject({ statusCode: 404 });
    await expect(makeService().listPaymentMethods()).resolves.toEqual([]);
  });
});

describe("getPaymentMethod", () => {
  it("returns a payment method owned by the customer without its token", async () => {
    const method = makePaymentMethod();
    await putItems(db, PaymentMethodsTable, [method]);

    await expect(makeService().getPaymentMethod(method.id)).resolves.toEqual(toDto(method));
  });

  it("marks the customer's default payment method", async () => {
    const method = makePaymentMethod();
    await putItems(db, PaymentMethodsTable, [method]);

    await expect(makeService({ defaultPaymentMethodId: method.id }).getPaymentMethod(method.id)).resolves.toEqual(
      toDto(method, true)
    );
  });

  it("throws a 404 when the payment method does not exist", async () => {
    const result = makeService().getPaymentMethod(crypto.randomUUID());

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 404 when the payment method belongs to another customer", async () => {
    const method = makePaymentMethod({ customerId: crypto.randomUUID() });
    await putItems(db, PaymentMethodsTable, [method]);

    const result = makeService().getPaymentMethod(method.id);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws a 500 when the stored payment method is malformed", async () => {
    const method = makePaymentMethod({ lastFour: "nope" });
    await putItems(db, PaymentMethodsTable, [method]);

    const result = makeService().getPaymentMethod(method.id);

    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ statusCode: 500 });
  });
});

describe("listPaymentMethods", () => {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);

  it("returns an empty list when the customer has no payment methods", async () => {
    await expect(makeService().listPaymentMethods()).resolves.toEqual([]);
  });

  it("returns only the customer's payment methods", async () => {
    const own = [makePaymentMethod(), makePaymentMethod({ brand: "mastercard", lastFour: "4444" })];
    await putItems(db, PaymentMethodsTable, [...own, makePaymentMethod({ customerId: crypto.randomUUID() })]);

    const result = await makeService({ defaultPaymentMethodId: own[1].id }).listPaymentMethods();

    expect(result.toSorted(byId)).toEqual([toDto(own[0]), toDto(own[1], true)].toSorted(byId));
  });
});

describe("updatePaymentMethod", () => {
  const expiration = { expirationMonth: 11, expirationYear: 2033 };

  it(
    "updates the expiration on the payment method and its vault card",
    async () => {
      const card = await putVaultCard();
      const method = makePaymentMethod({ token: card.token });
      await putItems(db, PaymentMethodsTable, [method]);

      const updated = await makeService().updatePaymentMethod(method.id, { expiration });

      expect(updated).toEqual(toDto({ ...method, ...expiration }));
      expect(await getRawPaymentMethod(method.id)).toEqual({ ...method, ...expiration });
      await vi.waitFor(async () => {
        expect(await getRawVaultCard(card.token)).toEqual({ ...card, ...expiration });
      }, waitForVault);
    },
    ASYNC_TIMEOUT + 5_000
  );

  it("sets the payment method as the default without changing other fields", async () => {
    const method = makePaymentMethod();
    await putItems(db, PaymentMethodsTable, [method]);

    const updated = await makeService().updatePaymentMethod(method.id, { setAsDefault: true });

    expect(updated).toEqual(toDto(method, true));
    expect(await getRawPaymentMethod(method.id)).toEqual(method);
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultPaymentMethodId: method.id });
  });

  it("updates the expiration and sets the default together", async () => {
    const card = await putVaultCard();
    const method = makePaymentMethod({ token: card.token });
    await putItems(db, PaymentMethodsTable, [method]);

    const updated = await makeService().updatePaymentMethod(method.id, { expiration, setAsDefault: true });

    expect(updated).toEqual(toDto({ ...method, ...expiration }, true));
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultPaymentMethodId: method.id });
  });

  it("leaves the customer record alone when the payment method is already the default", async () => {
    const method = makePaymentMethod();
    await putItems(db, PaymentMethodsTable, [method]);

    const updated = await makeService({ defaultPaymentMethodId: method.id }).updatePaymentMethod(method.id, {
      setAsDefault: true
    });

    expect(updated).toEqual(toDto(method, true));
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });

  it("does not create the payment method when it does not exist", async () => {
    const id = crypto.randomUUID();

    await expect(makeService().updatePaymentMethod(id, { expiration })).rejects.toMatchObject({ statusCode: 404 });
    expect(await getRawPaymentMethod(id)).toBeUndefined();
  });

  it("does not modify a payment method or vault card belonging to another customer", async () => {
    const otherCustomerId = crypto.randomUUID();
    const card = await putVaultCard({ customerId: otherCustomerId });
    const method = makePaymentMethod({ customerId: otherCustomerId, token: card.token });
    await putItems(db, PaymentMethodsTable, [method]);

    await expect(makeService().updatePaymentMethod(method.id, { expiration })).rejects.toMatchObject({
      statusCode: 404
    });
    expect(await getRawPaymentMethod(method.id)).toEqual(method);
    expect(await getRawVaultCard(card.token)).toEqual(card);
  });

  it("does not set another customer's payment method as the default", async () => {
    const method = makePaymentMethod({ customerId: crypto.randomUUID() });
    await putItems(db, PaymentMethodsTable, [method]);

    await expect(makeService().updatePaymentMethod(method.id, { setAsDefault: true })).rejects.toMatchObject({
      statusCode: 404
    });
    expect(await getRawCustomer(customerId)).toEqual({ id: customerId });
  });
});

describe("deletePaymentMethod", () => {
  it(
    "removes the payment method and its vault card",
    async () => {
      const card = await putVaultCard();
      const method = makePaymentMethod({ token: card.token });
      await putItems(db, PaymentMethodsTable, [method]);

      await makeService().deletePaymentMethod(method.id);

      expect(await getRawPaymentMethod(method.id)).toBeUndefined();
      await vi.waitFor(async () => {
        expect(await getRawVaultCard(card.token)).toBeUndefined();
      }, waitForVault);
    },
    ASYNC_TIMEOUT + 5_000
  );

  it("clears the customer's default when deleting the default payment method", async () => {
    const method = makePaymentMethod();
    await putItems(db, PaymentMethodsTable, [method]);
    await putItems(db, CustomersTable, [{ id: customerId, defaultPaymentMethodId: method.id }]);

    await makeService({ defaultPaymentMethodId: method.id }).deletePaymentMethod(method.id);

    expect(await getRawCustomer(customerId)).toEqual({ id: customerId, defaultPaymentMethodId: null });
  });

  it("does not remove a payment method or vault card belonging to another customer", async () => {
    const otherCustomerId = crypto.randomUUID();
    const card = await putVaultCard({ customerId: otherCustomerId });
    const method = makePaymentMethod({ customerId: otherCustomerId, token: card.token });
    await putItems(db, PaymentMethodsTable, [method]);

    await expect(makeService().deletePaymentMethod(method.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(await getRawPaymentMethod(method.id)).toEqual(method);
    expect(await getRawVaultCard(card.token)).toEqual(card);
  });

  it("throws a 404 when the payment method does not exist", async () => {
    await expect(makeService().deletePaymentMethod(crypto.randomUUID())).rejects.toMatchObject({ statusCode: 404 });
  });
});
