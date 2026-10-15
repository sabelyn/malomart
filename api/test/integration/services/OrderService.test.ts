import { DeleteCommand, GetCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, s3Client } from "@mm/clients";
import type { AddressDto, CreateOrderBody, Order, PaymentMethodDto, Product } from "@mm/lib";
import { Category, OrderStatus, ShippingMethod, ShippingOptions } from "@mm/lib";

import type { ICustomerService, IPaymentMethodService } from "@/contracts";
import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { notFound } from "@/errors/helpers";
import { OrderService, ProductService } from "@/services";
import type { User } from "@/types/user";
import { putItems, track, trackWhere } from "../../helpers/db";

const { carts: CartsTable, orders: OrdersTable, products: ProductsTable } = env.TABLE_NAMES;
const db = dbClient();

const getAddress = vi.fn<ICustomerService["getAddress"]>();
const getCustomerCart = vi.fn<ICustomerService["getCustomerCart"]>();
const customerService = { getAddress, getCustomerCart } as unknown as ICustomerService;

const getPaymentMethodWithToken = vi.fn<IPaymentMethodService["getPaymentMethodWithToken"]>();
const paymentMethodService = { getPaymentMethodWithToken } as unknown as IPaymentMethodService;

const productService = new ProductService(db, s3Client());

let customerId: string;

const addressDto: AddressDto = {
  id: crypto.randomUUID(),
  label: "Home",
  recipient: "Link",
  street: "12 Lost Woods Path",
  city: "Kakariko",
  region: "Eldin",
  postalCode: "12345",
  isDefault: true
};

const paymentMethodDto: PaymentMethodDto & { token: string } = {
  id: crypto.randomUUID(),
  brand: "Hyrulian Express",
  expirationMonth: 4,
  expirationYear: 2030,
  lastFour: "4242",
  isDefault: true,
  token: "tok_test"
};

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: customerId,
  email: "link@hyrule.test",
  name: "Link",
  isAdmin: false,
  signInMethod: "email",
  customerData: {},
  ...overrides
});

const makeService = (user = makeUser()) =>
  new OrderService(db, customerService, paymentMethodService, productService, user);

const asAdmin = () => makeService(makeUser({ id: crypto.randomUUID(), isAdmin: true }));

const makeOrder = (overrides: Partial<Order> = {}): Order => {
  const orderDate = overrides.orderDate ?? new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    customerId,
    orderDate,
    currentStatus: OrderStatus.Placed,
    statusUpdates: { [OrderStatus.Placed]: orderDate },
    products: { [crypto.randomUUID()]: { amount: 2, pricePerUnit: 50 } },
    shipping: { method: ShippingMethod.Standard, cost: 0 },
    address: {
      recipient: "Link",
      street: "12 Lost Woods Path",
      city: "Kakariko",
      region: "Eldin",
      postalCode: "12345"
    },
    paymentMethod: {
      brand: "Hyrulian Express",
      lastFour: "4242",
      expirationMonth: 4,
      expirationYear: 2030,
      token: "tok_test"
    },
    ...overrides
  };
};

const toDto = ({ paymentMethod: { brand, lastFour }, ...order }: Order) => ({
  ...order,
  paymentMethod: { brand, lastFour }
});

const toOverview = ({ id, customerId, orderDate, currentStatus }: Order, total = 100) => ({
  id,
  customerId,
  orderDate,
  currentStatus,
  total
});

const putOrders = (...orders: Order[]) => putItems(db, OrdersTable, orders);

const putProducts = async (...stockCounts: number[]) => {
  const products: Product[] = stockCounts.map((stockCount, i) => ({
    id: crypto.randomUUID(),
    title: `Mask of Truth ${i}`,
    description: "Allows you to see into the minds of others.",
    category: Category.Masks,
    price: 80 + i,
    stockCount,
    inStock: stockCount > 0 ? 1 : 0,
    features: []
  }));
  await putItems(db, ProductsTable, products);
  return products;
};

const getRawOrder = async (id: string) => (await db.send(new GetCommand({ TableName: OrdersTable, Key: { id } }))).Item;

const getRawProduct = async (id: string) =>
  (await db.send(new GetCommand({ TableName: ProductsTable, Key: { id } }))).Item;

const getRawCart = async () => (await db.send(new GetCommand({ TableName: CartsTable, Key: { customerId } }))).Item;

const getRawCustomerOrders = async () =>
  (
    await db.send(
      new ScanCommand({
        TableName: OrdersTable,
        ConsistentRead: true,
        FilterExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": customerId }
      })
    )
  ).Items ?? [];

const setCart = async (items: Record<string, number>) => {
  await putItems(db, CartsTable, [{ customerId, items }], ["customerId"]);
  getCustomerCart.mockResolvedValue(items);
};

const expectApiError = async (promise: Promise<unknown>, statusCode: number) => {
  await expect(promise).rejects.toBeInstanceOf(ApiError);
  await expect(promise).rejects.toMatchObject({ statusCode });
};

beforeEach(() => {
  customerId = crypto.randomUUID();
  getAddress.mockReset().mockResolvedValue(addressDto);
  getCustomerCart.mockReset().mockResolvedValue({});
  getPaymentMethodWithToken.mockReset().mockResolvedValue(paymentMethodDto);
});

afterEach(async () => {
  vi.restoreAllMocks();
  track(CartsTable, { customerId });
  await trackWhere(db, OrdersTable, "customerId", customerId);
});

describe("createOrder", () => {
  const expressCost = ShippingOptions[ShippingMethod.Express].cost;

  const orderBody = (
    items: Record<string, number>,
    products: Product[] = [],
    overrides: Partial<CreateOrderBody> = {}
  ): CreateOrderBody => {
    const prices = new Map(products.map(({ id, price }) => [id, price]));
    const subtotal = Object.entries(items).reduce((total, [id, amount]) => total + amount * (prices.get(id) ?? 0), 0);
    return {
      id: crypto.randomUUID(),
      addressId: addressDto.id,
      paymentMethodId: paymentMethodDto.id,
      shippingMethod: ShippingMethod.Express,
      items,
      expectedTotal: subtotal + expressCost,
      ...overrides
    };
  };

  const changeDuringCreate = (change: () => Promise<unknown>) => {
    const getProducts = productService.getProducts;
    vi.spyOn(productService, "getProducts").mockImplementationOnce(async ids => {
      const result = await getProducts(ids);
      await change();
      return result;
    });
  };

  it("stores the order, decrements stock, clears the cart, and hides the card token", async () => {
    const [first, second] = await putProducts(5, 3);
    const items = { [first.id]: 2, [second.id]: 3 };
    await setCart(items);
    const body = orderBody(items, [first, second]);

    const created = await makeService().createOrder(body);

    const { id: _, isDefault: __, label: ___, ...address } = addressDto;
    const expected = {
      id: body.id,
      customerId,
      orderDate: expect.any(String),
      currentStatus: OrderStatus.Placed,
      statusUpdates: { [OrderStatus.Placed]: created.orderDate },
      products: {
        [first.id]: { amount: 2, pricePerUnit: first.price },
        [second.id]: { amount: 3, pricePerUnit: second.price }
      },
      shipping: { method: ShippingMethod.Express, cost: expressCost },
      address
    };
    expect(created).toEqual({ ...expected, paymentMethod: { brand: "Hyrulian Express", lastFour: "4242" } });
    expect(await getRawOrder(body.id)).toEqual({
      ...expected,
      orderDate: created.orderDate,
      paymentMethod: {
        brand: "Hyrulian Express",
        lastFour: "4242",
        expirationMonth: 4,
        expirationYear: 2030,
        token: "tok_test"
      }
    });
    expect(await getRawProduct(first.id)).toMatchObject({ stockCount: 3 });
    expect(await getRawProduct(second.id)).toMatchObject({ stockCount: 0 });
    expect(await getRawCart()).toEqual({ customerId, items: {} });
  });

  it("looks up the requested address and payment method", async () => {
    const [product] = await putProducts(1);
    const items = { [product.id]: 1 };
    await setCart(items);

    await makeService().createOrder(orderBody(items, [product]));

    expect(getAddress).toHaveBeenCalledWith(addressDto.id);
    expect(getPaymentMethodWithToken).toHaveBeenCalledWith(paymentMethodDto.id);
  });

  it("returns the existing order without placing another when the same ID is submitted again", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 2 };
    await setCart(items);
    const body = orderBody(items, [product]);
    const service = makeService();

    const created = await service.createOrder(body);
    getCustomerCart.mockResolvedValue({});
    const repeated = await service.createOrder(body);

    expect(repeated).toEqual(created);
    expect(await getRawCustomerOrders()).toHaveLength(1);
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 3 });
  });

  it("returns the order when a concurrent request with the same ID places it first", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    const body = orderBody(items, [product]);
    const placed = makeOrder({ id: body.id });
    changeDuringCreate(() => putOrders(placed));

    await expect(makeService().createOrder(body)).resolves.toEqual(toDto(placed));
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 5 });
  });

  it("throws a 409 without changing anything when the ID belongs to another customer's order", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    const theirs = makeOrder({ customerId: crypto.randomUUID() });
    await putOrders(theirs);

    await expectApiError(makeService().createOrder(orderBody(items, [product], { id: theirs.id })), 409);
    expect(await getRawOrder(theirs.id)).toEqual(theirs);
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 5 });
  });

  it("throws a 400 when the cart is empty", async () => {
    await expectApiError(makeService().createOrder(orderBody({})), 400);
    expect(await getRawCustomerOrders()).toEqual([]);
  });

  it("throws a 400 when the payment method has expired", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    getPaymentMethodWithToken.mockResolvedValue({ ...paymentMethodDto, expirationYear: 2020 });

    await expectApiError(makeService().createOrder(orderBody(items, [product])), 400);
    expect(await getRawCustomerOrders()).toEqual([]);
  });

  it("throws a 409 when the cart doesn't match the reviewed items", async () => {
    const [product] = await putProducts(5);
    await setCart({ [product.id]: 2 });

    await expectApiError(makeService().createOrder(orderBody({ [product.id]: 1 }, [product])), 409);
    expect(await getRawCustomerOrders()).toEqual([]);
  });

  it("throws a 409 when the total doesn't match the reviewed total", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    const body = orderBody(items, [product]);

    await expectApiError(makeService().createOrder({ ...body, expectedTotal: body.expectedTotal - 1 }), 409);
    expect(await getRawCustomerOrders()).toEqual([]);
  });

  it("throws a 409 and changes nothing when the cart changes before the order is written", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    changeDuringCreate(() => putItems(db, CartsTable, [{ customerId, items: { [product.id]: 3 } }], ["customerId"]));

    await expectApiError(makeService().createOrder(orderBody(items, [product])), 409);
    expect(await getRawCustomerOrders()).toEqual([]);
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 5 });
    expect(await getRawCart()).toEqual({ customerId, items: { [product.id]: 3 } });
  });

  it("places only one order when the same cart is submitted twice with different IDs", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 2 };
    await setCart(items);
    const service = makeService();

    const results = await Promise.allSettled([
      service.createOrder(orderBody(items, [product])),
      service.createOrder(orderBody(items, [product]))
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(await getRawCustomerOrders()).toHaveLength(1);
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 3 });
  });

  it("throws a 409 and changes nothing when the cart exceeds the stock", async () => {
    const [plenty, scarce] = await putProducts(5, 1);
    const items = { [plenty.id]: 1, [scarce.id]: 2 };
    await setCart(items);

    await expectApiError(makeService().createOrder(orderBody(items, [plenty, scarce])), 409);

    expect(await getRawCustomerOrders()).toEqual([]);
    expect(await getRawProduct(plenty.id)).toMatchObject({ stockCount: 5 });
    expect(await getRawCart()).toEqual({ customerId, items });
  });

  it("throws a 404 when a product in the cart does not exist", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1, [crypto.randomUUID()]: 1 };
    await setCart(items);

    await expectApiError(makeService().createOrder(orderBody(items, [product])), 404);
    expect(await getRawCustomerOrders()).toEqual([]);
  });

  it("throws a 409 and changes nothing when stock runs out before the order is written", async () => {
    const [plenty, scarce] = await putProducts(5, 2);
    const items = { [plenty.id]: 1, [scarce.id]: 2 };
    await setCart(items);
    changeDuringCreate(() =>
      db.send(
        new UpdateCommand({
          TableName: ProductsTable,
          Key: { id: scarce.id },
          UpdateExpression: "SET stockCount = :one",
          ExpressionAttributeValues: { ":one": 1 }
        })
      )
    );

    const result = makeService().createOrder(orderBody(items, [plenty, scarce]));

    await expectApiError(result, 409);
    await expect(result).rejects.toMatchObject({ message: `Not enough ${scarce.title} in stock.` });
    expect(await getRawCustomerOrders()).toEqual([]);
    expect(await getRawProduct(plenty.id)).toMatchObject({ stockCount: 5 });
    expect(await getRawCart()).toEqual({ customerId, items });
  });

  it("throws a 404 when a product is deleted before the order is written", async () => {
    const [plenty, removed] = await putProducts(5, 2);
    const items = { [plenty.id]: 1, [removed.id]: 1 };
    await setCart(items);
    changeDuringCreate(() => db.send(new DeleteCommand({ TableName: ProductsTable, Key: { id: removed.id } })));

    await expectApiError(makeService().createOrder(orderBody(items, [plenty, removed])), 404);
    expect(await getRawCustomerOrders()).toEqual([]);
    expect(await getRawProduct(plenty.id)).toMatchObject({ stockCount: 5 });
  });

  it("does not write anything when the address cannot be found", async () => {
    const [product] = await putProducts(5);
    const items = { [product.id]: 1 };
    await setCart(items);
    getAddress.mockRejectedValue(notFound("Address could not be found."));

    await expectApiError(makeService().createOrder(orderBody(items, [product])), 404);
    expect(await getRawCustomerOrders()).toEqual([]);
    expect(await getRawProduct(product.id)).toMatchObject({ stockCount: 5 });
  });
});

describe("getOrder", () => {
  it("returns the customer's order without the card token", async () => {
    const order = makeOrder();
    await putOrders(order);

    await expect(makeService().getOrder(order.id)).resolves.toEqual(toDto(order));
  });

  it("returns another customer's order to an admin", async () => {
    const order = makeOrder();
    await putOrders(order);

    await expect(asAdmin().getOrder(order.id)).resolves.toEqual(toDto(order));
  });

  it("throws a 404 when the order belongs to another customer", async () => {
    const order = makeOrder({ customerId: crypto.randomUUID() });
    await putOrders(order);

    await expectApiError(makeService().getOrder(order.id), 404);
  });

  it("throws a 404 when the order does not exist", async () => {
    await expectApiError(makeService().getOrder(crypto.randomUUID()), 404);
  });

  it("throws a 500 when the stored order is malformed", async () => {
    const order = makeOrder({ currentStatus: "Lost" as Order["currentStatus"] });
    await putOrders(order);

    await expectApiError(makeService().getOrder(order.id), 500);
  });
});

describe("cancelOrder", () => {
  it.each([OrderStatus.Placed, OrderStatus.Confirmed])("cancels the customer's %s order", async currentStatus => {
    const order = makeOrder({ currentStatus });
    await putOrders(order);

    await makeService().cancelOrder(order.id);

    expect(await getRawOrder(order.id)).toEqual({
      ...order,
      currentStatus: OrderStatus.Cancelled,
      statusUpdates: { ...order.statusUpdates, [OrderStatus.Cancelled]: expect.any(String) }
    });
  });

  it("lets an admin cancel another customer's order", async () => {
    const order = makeOrder();
    await putOrders(order);

    await asAdmin().cancelOrder(order.id);

    expect(await getRawOrder(order.id)).toMatchObject({ currentStatus: OrderStatus.Cancelled });
  });

  it.each([OrderStatus.Shipped, OrderStatus.Delivered, OrderStatus.Cancelled])(
    "throws a 409 and leaves a %s order unchanged",
    async currentStatus => {
      const order = makeOrder({ currentStatus });
      await putOrders(order);

      await expectApiError(makeService().cancelOrder(order.id), 409);
      expect(await getRawOrder(order.id)).toEqual(order);
    }
  );

  it("throws a 409 when an admin cancels a shipped order", async () => {
    const order = makeOrder({ currentStatus: OrderStatus.Shipped });
    await putOrders(order);

    await expectApiError(asAdmin().cancelOrder(order.id), 409);
  });

  it.each([OrderStatus.Placed, OrderStatus.Shipped])(
    "throws a 404 and leaves another customer's %s order unchanged",
    async currentStatus => {
      const order = makeOrder({ customerId: crypto.randomUUID(), currentStatus });
      await putOrders(order);

      await expectApiError(makeService().cancelOrder(order.id), 404);
      expect(await getRawOrder(order.id)).toEqual(order);
    }
  );

  it("throws a 404 without creating an order when it does not exist", async () => {
    const id = crypto.randomUUID();

    await expectApiError(makeService().cancelOrder(id), 404);
    expect(await getRawOrder(id)).toBeUndefined();
  });
});

describe("listOrders", () => {
  type ListQuery = Omit<Parameters<OrderService["listOrders"]>[0], "cursor">;

  const listAll = async (service: OrderService, query: ListQuery) => {
    const pages = [];
    let cursor: string | undefined;
    do {
      const page = await service.listOrders({ ...query, cursor });
      pages.push(page);
      cursor = page.pagination.cursor;
    } while (cursor);
    return pages;
  };

  const listOwn = async (service: OrderService, orders: Order[], query: ListQuery) => {
    const ids = new Set(orders.map(o => o.id));
    const pages = await listAll(service, query);
    return pages.flatMap(page => page.data).filter(item => ids.has(item.id));
  };

  const datedOrders = (count: number, overrides: (i: number) => Partial<Order> = () => ({})) =>
    Array.from({ length: count }, (_, i) =>
      makeOrder({ orderDate: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), ...overrides(i) })
    );

  const newestFirst = (orders: Order[]) => orders.toSorted((a, b) => b.orderDate.localeCompare(a.orderDate));

  it("returns the customer's orders newest first with totals", async () => {
    const own = datedOrders(3);
    own[1].products = {
      [crypto.randomUUID()]: { amount: 3, pricePerUnit: 20 },
      [crypto.randomUUID()]: { amount: 1, pricePerUnit: 5 }
    };
    own[1].shipping = { method: ShippingMethod.Express, cost: 40 };
    await putOrders(...own, makeOrder({ customerId: crypto.randomUUID() }));

    const { data } = await makeService().listOrders({ limit: 10 });

    expect(data).toEqual(newestFirst(own).map(o => toOverview(o, o === own[1] ? 105 : 100)));
  });

  it("ignores the customerId filter for non-admins", async () => {
    const own = datedOrders(2);
    const other = makeOrder({ customerId: crypto.randomUUID() });
    await putOrders(...own, other);

    const { data } = await makeService().listOrders({ limit: 10, customerId: other.customerId });

    expect(data).toEqual(newestFirst(own).map(o => toOverview(o)));
  });

  it("filters the customer's orders by status", async () => {
    const own = datedOrders(4, i => ({ currentStatus: i % 2 ? OrderStatus.Shipped : OrderStatus.Placed }));
    await putOrders(...own);

    const { data } = await makeService().listOrders({ limit: 10, status: OrderStatus.Shipped });

    expect(data).toEqual(newestFirst(own.filter(o => o.currentStatus === OrderStatus.Shipped)).map(o => toOverview(o)));
  });

  it("lets an admin filter by customer", async () => {
    const own = datedOrders(2);
    await putOrders(...own, makeOrder({ customerId: crypto.randomUUID() }));

    const { data } = await asAdmin().listOrders({ limit: 10, customerId });

    expect(data).toEqual(newestFirst(own).map(o => toOverview(o)));
  });

  it("lets an admin filter by customer and status", async () => {
    const own = datedOrders(3, i => ({ currentStatus: i ? OrderStatus.Confirmed : OrderStatus.Placed }));
    await putOrders(...own);

    const { data } = await asAdmin().listOrders({ limit: 10, customerId, status: OrderStatus.Confirmed });

    expect(data).toEqual(newestFirst(own.slice(1)).map(o => toOverview(o)));
  });

  it("lets an admin filter by status across customers", async () => {
    const other = makeOrder({ customerId: crypto.randomUUID(), currentStatus: OrderStatus.Delivered });
    const orders = [makeOrder({ currentStatus: OrderStatus.Delivered }), other, makeOrder()];
    await putOrders(...orders);

    const result = await listOwn(asAdmin(), orders, { limit: 100, status: OrderStatus.Delivered });

    expect(result.map(o => o.id).toSorted()).toEqual([orders[0].id, other.id].toSorted());
  });

  it("returns every customer's orders to an admin with no filters", async () => {
    const orders = [makeOrder(), makeOrder({ customerId: crypto.randomUUID() })];
    await putOrders(...orders);

    const result = await listOwn(asAdmin(), orders, { limit: 100 });

    expect(result.map(o => o.id).toSorted()).toEqual(orders.map(o => o.id).toSorted());
  });

  it.each([
    ["a customer's orders", () => makeService(), {}, () => true],
    [
      "a customer's orders by status",
      () => makeService(),
      { status: OrderStatus.Placed },
      (o: Order) => o.currentStatus === OrderStatus.Placed
    ],
    ["all orders as an admin", () => asAdmin(), {}, () => true],
    [
      "orders by status as an admin",
      () => asAdmin(),
      { status: OrderStatus.Placed },
      (o: Order) => o.currentStatus === OrderStatus.Placed
    ]
  ])("paginates through %s without duplicates or gaps", async (_, makeListService, filters, predicate) => {
    const orders = datedOrders(25, i => ({ currentStatus: i % 3 ? OrderStatus.Placed : OrderStatus.Shipped }));
    await putOrders(...orders);

    const pages = await listAll(makeListService(), { limit: 10, ...filters });
    const all = pages.flatMap(page => page.data);
    const ids = new Set(orders.map(o => o.id));

    for (const page of pages) {
      expect(page.data.length).toBeLessThanOrEqual(10);
    }
    expect(pages.at(-1)!.pagination.hasNext).toBe(false);
    expect(new Set(all.map(item => item.id)).size).toBe(all.length);
    expect(
      all
        .filter(item => ids.has(item.id))
        .map(o => o.id)
        .toSorted()
    ).toEqual(
      orders
        .filter(predicate)
        .map(o => o.id)
        .toSorted()
    );
  });

  it.each([
    ["is not valid base64 JSON", "not-a-cursor"],
    ["has keys that do not match the query", Buffer.from(JSON.stringify({ other: "x" })).toString("base64url")]
  ])("throws a 400 when the cursor %s", async (_, cursor) => {
    await expectApiError(makeService().listOrders({ limit: 10, cursor }), 400);
  });
});
