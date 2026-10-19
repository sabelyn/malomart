import type { AddressDto, PaymentMethodDto } from "@mm/lib/customers";
import type { CreateOrderBody, OrderDto } from "@mm/lib/orders";
import { getOrder, ShippingOptions } from "@mm/lib/orders";
import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import { endpointQuery } from "@/api";
import { serverCartQuery } from "@/components/cart/CartProvider";
import CheckoutPage from "@/pages/CheckoutPage";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo } from "../../utils";

const CUSTOMER_ID = "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d";
const ORDERS = "POST /api/orders";

const shield: ProductOverview = {
  id: "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01",
  title: "Hylian Shield",
  category: "Shields",
  price: 200,
  stockCount: 5
};
const potion: ProductOverview = {
  id: "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00",
  title: "Red Potion",
  category: "Potions",
  price: 20,
  stockCount: 2,
  thumbnailKey: "products/potion/front"
};
const catalog = [shield, potion];

const home: AddressDto = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  label: "Home",
  recipient: "Link",
  street: "1 Ordon Lane",
  city: "Ordon Village",
  region: "Faron",
  postalCode: "11111",
  isDefault: false
};
const ranch: AddressDto = {
  id: "8f2b6d3a-1c4e-4b7f-9a2d-3e5f7a9c1b20",
  recipient: "Malon",
  street: "2 Lon Lon Road",
  city: "Lon Lon Ranch",
  region: "Central Hyrule",
  postalCode: "22222",
  isDefault: true
};

const express: PaymentMethodDto = {
  id: "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e",
  brand: "Hyrulean Express",
  lastFour: "4242",
  expirationMonth: 4,
  expirationYear: 2030,
  isDefault: true
};
const castle: PaymentMethodDto = {
  id: "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f",
  brand: "Castle One",
  lastFour: "1111",
  expirationMonth: 2,
  expirationYear: 2025,
  isDefault: false
};

type Cart = Record<string, number>;
type Handler = (body: unknown) => Response;

let serverCart: Cart;
let addresses: AddressDto[];
let cards: PaymentMethodDto[];

const placedOrder = (body: CreateOrderBody): OrderDto => ({
  id: body.id,
  customerId: CUSTOMER_ID,
  products: Object.fromEntries(
    Object.entries(body.items).map(([id, amount]) => {
      const product = catalog.find(item => item.id === id)!;
      return [id, { title: product.title, amount, pricePerUnit: product.price }];
    })
  ),
  currentStatus: "Placed",
  statusUpdates: { Placed: "2026-06-15T12:00:00.000Z" },
  orderDate: "2026-06-15T12:00:00.000Z",
  address: {
    recipient: ranch.recipient,
    street: ranch.street,
    city: ranch.city,
    region: ranch.region,
    postalCode: ranch.postalCode
  },
  shipping: { method: body.shippingMethod, cost: ShippingOptions[body.shippingMethod].cost },
  paymentMethod: { brand: express.brand, lastFour: express.lastFour }
});

const stubCheckoutApi = (handlers: Record<string, Handler> = {}) => {
  const routes: Record<string, (url: URL, body: unknown) => Response> = {
    "GET /api/customers": () =>
      json(200, { id: CUSTOMER_ID, defaultAddress: null, defaultPaymentMethod: null, cart: serverCart }),
    "GET /api/customers/addresses": () => json(200, addresses),
    "GET /api/customers/payment-methods": () => json(200, cards),
    "GET /api/products/batch": url => {
      const ids = url.searchParams.get("ids")?.split(",") ?? [];
      return json(
        200,
        catalog.filter(product => ids.includes(product.id))
      );
    },
    [ORDERS]: (_, body) => json(201, placedOrder(body as CreateOrderBody)),
    ...Object.fromEntries(
      Object.entries(handlers).map(([route, handler]) => [route, (_: URL, body: unknown) => handler(body)])
    )
  };
  const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
    const url = new URL(String(input), "http://localhost");
    const route = `${init?.method ?? "GET"} ${url.pathname}`;
    const handler = routes[route];
    if (!handler) {
      return Promise.reject(new Error(`Unexpected request: ${route}`));
    }
    return Promise.resolve(handler(url, typeof init?.body === "string" ? JSON.parse(init.body) : undefined));
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const callsTo = (fetch: ReturnType<typeof stubCheckoutApi>, pathname: string) =>
  fetch.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === pathname).length;

const renderCheckout = () =>
  renderWithProviders(
    <Routes>
      <Route path="/checkout" element={<CheckoutPage />} />
      <Route path="/orders/:id/placed" element={<LocationDisplay />} />
    </Routes>,
    { route: "/checkout", session: { ...customer, id: CUSTOMER_ID }, withCart: true }
  );

const section = (name: string) => screen.getByRole("region", { name });
const radio = (sectionName: string, name: string) =>
  within(section(sectionName)).getByRole("radio", { name: new RegExp(`^${name}`) });
const isChecked = (element: HTMLElement) => (element as HTMLInputElement).checked;
const placeOrderButton = () => screen.getByRole("button", { name: "Place order" });
const dialog = () => screen.getByRole("dialog");

const loaded = async () => {
  await screen.findByRole("heading", { level: 3, name: "Hylian Shield" });
  await within(section("Ship to")).findAllByRole("radio");
  await within(section("Pay with")).findAllByRole("radio");
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 5, 15));
  serverCart = { [shield.id]: 2, [potion.id]: 1 };
  addresses = [home, ranch];
  cards = [express, castle];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CheckoutPage", () => {
  it("sends shoppers back to the shelves when the cart is empty", async () => {
    serverCart = {};
    stubCheckoutApi();
    renderCheckout();

    expect(await screen.findByText("Nothing to check out. Bold strategy.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go shopping" }).getAttribute("href")).toBe("/products");
    expect(screen.queryByRole("button", { name: "Place order" })).toBeNull();
  });

  it("shows the cart with the default address and card picked and expired cards disabled", async () => {
    stubCheckoutApi();
    renderCheckout();
    await loaded();

    expect(document.title).toBe("Checkout · Malo Mart");
    expect(isChecked(radio("Ship to", "2 Lon Lon Road"))).toBe(true);
    expect(isChecked(radio("Ship to", "Home"))).toBe(false);
    expect(isChecked(radio("Pay with", "Hyrulean Express ending in 4242"))).toBe(true);
    expect((radio("Pay with", "Castle One ending in 1111") as HTMLInputElement).disabled).toBe(true);
    expect(
      within(section("Pay with")).getByRole("link", { name: "Update them in your account" }).getAttribute("href")
    ).toBe("/account/payment-methods");
    expect(isChecked(radio("Delivery", "Postman Standard"))).toBe(true);

    const items = section("Your items");
    expect(
      within(items)
        .getAllByRole("heading", { level: 3 })
        .map(heading => heading.textContent)
    ).toEqual(["Hylian Shield", "Red Potion"]);
    expect(within(items).getByText("Quantity 2, 200 rupees each")).toBeTruthy();
    expect(within(items).getByRole("link", { name: "Edit cart" }).getAttribute("href")).toBe("/cart");

    const summary = section("Order summary");
    expect(within(summary).getByText("Subtotal")).toBeTruthy();
    expect(within(summary).getByText("420 rupees", { selector: "dd" })).toBeTruthy();
    expect(within(summary).getByText("Free")).toBeTruthy();
    expect(within(summary).getByText("420")).toBeTruthy();
  });

  it("places the order with the chosen address, card, and delivery, then shows it was placed", async () => {
    const fetch = stubCheckoutApi();
    const user = userEvent.setup();
    const { queryClient } = renderCheckout();
    await loaded();

    await user.click(radio("Ship to", "Home"));
    await user.click(radio("Delivery", "Epona Express"));

    const summary = section("Order summary");
    expect(within(summary).getByText("40 rupees")).toBeTruthy();
    expect(within(summary).getByText("460")).toBeTruthy();

    await user.click(placeOrderButton());

    const [body] = requestsTo(fetch, ORDERS) as CreateOrderBody[];
    expect(body).toEqual({
      id: expect.any(String),
      addressId: home.id,
      paymentMethodId: express.id,
      shippingMethod: "Express",
      items: { [shield.id]: 2, [potion.id]: 1 },
      expectedTotal: 460
    });
    expect((await screen.findByTestId("location")).textContent).toBe(`/orders/${body.id}/placed`);
    expect(queryClient.getQueryData(endpointQuery(getOrder, { params: { id: body.id } }).queryKey)).toEqual(
      placedOrder(body)
    );
    expect(queryClient.getQueryData(serverCartQuery(CUSTOMER_ID).queryKey)).toEqual({});
  });

  it("says what to add and focuses the address step when nothing is saved yet", async () => {
    addresses = [];
    cards = [];
    const fetch = stubCheckoutApi();
    const user = userEvent.setup();
    renderCheckout();

    expect(await screen.findByText("No addresses yet. Can't deliver to nowhere.")).toBeTruthy();
    expect(await screen.findByText("No cards on file. I don't do IOUs.")).toBeTruthy();
    await user.click(placeOrderButton());

    const addAddress = within(section("Ship to")).getByRole("button", { name: "Add an address" });
    expect(document.activeElement).toBe(addAddress);
    expect(addAddress.getAttribute("aria-describedby")).toBe("checkout-address-error");
    expect(screen.getByText("Add an address first. I need somewhere to send it.").id).toBe("checkout-address-error");
    expect(within(section("Pay with")).getByText("Add a card first. No rupees, no goods.")).toBeTruthy();
    expect(requestsTo(fetch, ORDERS)).toHaveLength(0);
  });

  it("asks for a choice when there's no usable default and moves focus to each missing step in turn", async () => {
    addresses = [{ ...ranch, isDefault: false }, home];
    cards = [
      { ...express, isDefault: false },
      { ...castle, isDefault: true }
    ];
    const fetch = stubCheckoutApi();
    const user = userEvent.setup();
    renderCheckout();
    await loaded();

    expect(within(section("Ship to")).queryAllByRole("radio", { checked: true })).toHaveLength(0);
    expect(within(section("Pay with")).queryAllByRole("radio", { checked: true })).toHaveLength(0);

    await user.click(placeOrderButton());

    expect(within(section("Ship to")).getByText("Choose where this is going.")).toBeTruthy();
    expect(within(section("Pay with")).getByText("Choose a card to pay with.")).toBeTruthy();
    expect(document.activeElement).toBe(radio("Ship to", "2 Lon Lon Road"));

    await user.click(radio("Ship to", "Home"));
    expect(within(section("Ship to")).queryByText("Choose where this is going.")).toBeNull();
    await user.click(placeOrderButton());

    expect(document.activeElement).toBe(radio("Pay with", "Hyrulean Express ending in 4242"));

    await user.click(radio("Pay with", "Hyrulean Express ending in 4242"));
    expect(within(section("Pay with")).queryByText("Choose a card to pay with.")).toBeNull();
    await user.click(placeOrderButton());

    await waitFor(() => expect(requestsTo(fetch, ORDERS)).toHaveLength(1));
    expect(requestsTo(fetch, ORDERS)[0]).toMatchObject({ addressId: home.id, paymentMethodId: express.id });
  });

  it("adds an address during checkout and picks it for the order", async () => {
    const created: AddressDto = { ...home, id: "4d5e6f7a-8b9c-4d0e-9f1a-2b3c4d5e6f7a", label: "Hideout" };
    const fetch = stubCheckoutApi({
      "POST /api/customers/addresses": () => {
        addresses = [...addresses, created];
        return json(201, created);
      }
    });
    const user = userEvent.setup();
    renderCheckout();
    await loaded();

    await user.click(within(section("Ship to")).getByRole("button", { name: "Add an address" }));
    const form = within(dialog());
    await user.type(form.getByLabelText("Label"), "Hideout");
    await user.type(form.getByLabelText(/^Recipient/), "Link");
    await user.type(form.getByLabelText(/^Street/), "1 Ordon Lane");
    await user.type(form.getByLabelText(/^City/), "Ordon Village");
    await user.selectOptions(form.getByLabelText(/^Region/), "Faron");
    await user.type(form.getByLabelText(/^Postal code/), "11111");
    await user.click(form.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(section("Ship to")).getByRole("status").textContent).toBe(
      "Added Hideout and picked it for this order."
    );
    await waitFor(() => expect(isChecked(radio("Ship to", "Hideout"))).toBe(true));

    await user.click(placeOrderButton());

    await waitFor(() => expect(requestsTo(fetch, ORDERS)).toHaveLength(1));
    expect(requestsTo(fetch, ORDERS)[0]).toMatchObject({ addressId: created.id });
  });

  it("adds a card during checkout and picks it for the order", async () => {
    const created: PaymentMethodDto = {
      ...express,
      id: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
      lastFour: "9999",
      isDefault: false
    };
    const fetch = stubCheckoutApi({
      "POST /api/tokenize": () => json(201, { token: "vault-token" }),
      "POST /api/customers/payment-methods": () => {
        cards = [...cards, created];
        return json(201, created);
      }
    });
    const user = userEvent.setup();
    renderCheckout();
    await loaded();

    await user.click(within(section("Pay with")).getByRole("button", { name: "Add a card" }));
    const form = within(dialog());
    await user.click(form.getByLabelText("Hyrulean Express"));
    await user.type(form.getByLabelText(/^Card number/), "4111 1111 1111 9999");
    await user.selectOptions(form.getByLabelText(/^Expiration month/), "05");
    await user.selectOptions(form.getByLabelText(/^Expiration year/), "2030");
    await user.click(form.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(within(section("Pay with")).getByRole("status").textContent).toBe(
      "Added Hyrulean Express ending in 9999 and picked it for this order."
    );
    await waitFor(() => expect(isChecked(radio("Pay with", "Hyrulean Express ending in 9999"))).toBe(true));

    await user.click(placeOrderButton());

    await waitFor(() => expect(requestsTo(fetch, ORDERS)).toHaveLength(1));
    expect(requestsTo(fetch, ORDERS)[0]).toMatchObject({ paymentMethodId: created.id });
  });

  it("reloads the cart and products when the order is out of date and retries with the same order ID", async () => {
    let stale = true;
    const fetch = stubCheckoutApi({
      [ORDERS]: body =>
        stale ? json(409, { message: "The cart changed." }) : json(201, placedOrder(body as CreateOrderBody))
    });
    const user = userEvent.setup();
    renderCheckout();
    await loaded();
    const cartLoads = callsTo(fetch, "/api/customers");
    const productLoads = callsTo(fetch, "/api/products/batch");

    await user.click(placeOrderButton());

    const alert = await within(section("Order summary")).findByRole("alert");
    expect(alert.textContent).toContain(
      "Something changed while you were looking. I updated everything, so check it over and try again."
    );
    await waitFor(() => expect(callsTo(fetch, "/api/customers")).toBe(cartLoads + 1));
    await waitFor(() => expect(callsTo(fetch, "/api/products/batch")).toBe(productLoads + 1));

    stale = false;
    await user.click(placeOrderButton());

    const [first, second] = requestsTo(fetch, ORDERS) as CreateOrderBody[];
    expect(second.id).toBe(first.id);
    expect((await screen.findByTestId("location")).textContent).toBe(`/orders/${first.id}/placed`);
  });

  it("says when the server rejects the order as invalid", async () => {
    const fetch = stubCheckoutApi({ [ORDERS]: () => json(400, { message: "Payment method expired." }) });
    const user = userEvent.setup();
    renderCheckout();
    await loaded();
    const cartLoads = callsTo(fetch, "/api/customers");

    await user.click(placeOrderButton());

    const alert = await within(section("Order summary")).findByRole("alert");
    expect(alert.textContent).toContain(
      "Something's off with your order. Check your address and card, then try again."
    );
    expect(callsTo(fetch, "/api/customers")).toBe(cartLoads);
    expect(screen.queryByTestId("location")).toBeNull();
  });

  it("offers a retry when saved addresses fail to load", async () => {
    let fail = true;
    stubCheckoutApi({
      "GET /api/customers/addresses": () => (fail ? json(500, { message: "nope" }) : json(200, addresses))
    });
    const user = userEvent.setup();
    renderCheckout();

    const alert = await within(await screen.findByRole("region", { name: "Ship to" })).findByRole("alert");
    expect(alert.textContent).toContain("Couldn't find your addresses. Not my fault.");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await within(section("Ship to")).findByRole("radio", { name: /^Home/ })).toBeTruthy();
  });
});
