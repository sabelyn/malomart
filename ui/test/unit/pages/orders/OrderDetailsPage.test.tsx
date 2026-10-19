import type { OrderDto } from "@mm/lib/orders";
import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import OrderDetailsPage from "@/pages/orders/OrderDetailsPage";
import { admin, customer, json, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const ORDER_ID = "6b20c73c-4f92-4e45-b156-a95deeed1258";
const ORDER_NUMBER = "6B20C73C";
const GET_ORDER = `GET /api/orders/${ORDER_ID}`;
const CANCEL = `PUT /api/orders/${ORDER_ID}/cancel`;

const shield: ProductOverview = {
  id: "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01",
  title: "Hylian Shield",
  category: "Shields",
  price: 200,
  stockCount: 5,
  thumbnailKey: "products/shield/front"
};
const potion: ProductOverview = {
  id: "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00",
  title: "Red Potion",
  category: "Potions",
  price: 20,
  stockCount: 2
};
const PRODUCTS = `GET /api/products/batch?${new URLSearchParams({ ids: `${shield.id},${potion.id}` })}`;

const confirmed: OrderDto = {
  id: ORDER_ID,
  customerId: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  products: {
    [shield.id]: { title: "Hylian Shield", amount: 2, pricePerUnit: 200 },
    [potion.id]: { title: "Red Potion", amount: 1, pricePerUnit: 20 }
  },
  currentStatus: "Confirmed",
  statusUpdates: { Placed: "2026-10-15T12:00:00.000Z", Confirmed: "2026-10-15T12:00:20.000Z" },
  orderDate: "2026-10-15T12:00:00.000Z",
  address: {
    recipient: "Malon",
    street: "2 Lon Lon Road",
    city: "Lon Lon Ranch",
    region: "Central Hyrule",
    postalCode: "22222"
  },
  shipping: { method: "Express", cost: 40 },
  paymentMethod: { brand: "Hyrulean Express", lastFour: "4242" }
};

let order: OrderDto;

const stubOrderApi = (handlers: Parameters<typeof stubApi>[0] = {}) =>
  stubApi({
    [GET_ORDER]: () => json(200, order),
    [PRODUCTS]: () => json(200, [shield, potion]),
    ...handlers
  });

const renderOrder = () =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailsPage />} />
    </Routes>,
    { route: `/orders/${ORDER_ID}`, session: customer }
  );

const heading = () => screen.findByRole("heading", { level: 1, name: `Order ${ORDER_NUMBER}` });
const section = (name: string) => screen.getByRole("region", { name });
const cancelButton = () => screen.getByRole("button", { name: "Cancel order" });
const dialog = () => screen.getByRole("dialog", { name: "Cancel this order?" });

beforeEach(() => {
  order = confirmed;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OrderDetailsPage", () => {
  it("shows the order's status, updates, details, items, and totals", async () => {
    stubOrderApi();
    renderOrder();
    await heading();

    expect(document.title).toBe(`Order ${ORDER_NUMBER} · Malo Mart`);
    expect(screen.getByText(/^Placed October 15, 2026\./).textContent).toBe(
      "Placed October 15, 2026. Status: Confirmed"
    );
    expect(within(section("Order updates")).getByRole("listitem", { current: "step" }).textContent).toContain(
      "Confirmed"
    );

    const details = section("Details");
    expect(within(details).getByText("Malon")).toBeTruthy();
    expect(within(details).getByText("Lon Lon Ranch, Central Hyrule 22222")).toBeTruthy();
    expect(within(details).getByText("Epona Express, 2 to 3 days. 40 rupees.")).toBeTruthy();
    expect(within(details).getByText("Hyrulean Express ending in 4242")).toBeTruthy();

    const items = section("Items");
    await waitFor(() => expect(within(items).getAllByRole("listitem")).toHaveLength(2));
    expect(
      within(items)
        .getAllByRole("heading", { level: 3 })
        .map(item => item.textContent)
    ).toEqual(["Hylian Shield", "Red Potion"]);
    expect(within(items).getByText("Quantity 2, 200 rupees each")).toBeTruthy();
    expect(items.querySelector("img")?.getAttribute("src")).toContain("products/shield/front");
    expect(within(items).getByText("Subtotal, 3 items")).toBeTruthy();
    expect(within(items).getByText("420 rupees")).toBeTruthy();
    expect(within(items).getByText("40 rupees")).toBeTruthy();
    expect(within(items).getByText("460 rupees")).toBeTruthy();

    expect(screen.getByRole("link", { name: "All your orders" }).getAttribute("href")).toBe("/account/orders");
  });

  it("lists items from the order even when their products can't be loaded", async () => {
    stubOrderApi({ [PRODUCTS]: () => json(500, { message: "nope" }) });
    renderOrder();
    await heading();

    const items = section("Items");
    await waitFor(() => expect(within(items).getAllByRole("heading", { level: 3 })).toHaveLength(2));
    expect(within(items).getByText("Quantity 1, 20 rupees each")).toBeTruthy();
    expect(items.querySelector("img")).toBeNull();
  });

  it("cancels the order after confirming and moves focus back to the heading", async () => {
    const fetch = stubOrderApi({
      [CANCEL]: () => {
        order = {
          ...confirmed,
          currentStatus: "Cancelled",
          statusUpdates: { ...confirmed.statusUpdates, Cancelled: "2026-10-15T12:05:00.000Z" },
          cancellationReason: "Requested"
        };
        return json(204);
      }
    });
    const user = userEvent.setup();
    renderOrder();
    await heading();

    await user.click(cancelButton());
    const descriptionId = dialog().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(descriptionId)?.textContent).toBe(
      `Order ${ORDER_NUMBER} won't ship. No take-backs.`
    );
    await user.click(within(dialog()).getByRole("button", { name: "Cancel order" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, CANCEL)).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("Order cancelled.");
    await waitFor(() =>
      expect(screen.getByText(/^Placed October 15, 2026\./).textContent).toMatch(/Status: Cancelled$/)
    );
    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
    expect(within(section("Order updates")).getByRole("listitem", { current: "step" }).textContent).toContain(
      "Cancelled. Nothing ships."
    );
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })));
  });

  it("keeps the order when the cancel is dismissed", async () => {
    const fetch = stubOrderApi();
    const user = userEvent.setup();
    renderOrder();
    await heading();

    await user.click(cancelButton());
    await user.click(within(dialog()).getByRole("button", { name: "Keep order" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, CANCEL)).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toBe("");
    expect(cancelButton()).toBeTruthy();
  });

  it("says when the order can't be cancelled and clears the error when reopened", async () => {
    stubOrderApi({ [CANCEL]: () => json(409, { message: "Already shipped." }) });
    const user = userEvent.setup();
    renderOrder();
    await heading();

    await user.click(cancelButton());
    await user.click(within(dialog()).getByRole("button", { name: "Cancel order" }));

    expect(await within(dialog()).findByText("Couldn't cancel the order. It may have already shipped.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");

    await user.click(within(dialog()).getByRole("button", { name: "Keep order" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.click(cancelButton());

    expect(within(dialog()).queryByText("Couldn't cancel the order. It may have already shipped.")).toBeNull();
  });

  it.each(["Shipped", "Delivered", "Cancelled"] as const)("doesn't offer cancelling a %s order", async status => {
    order = { ...confirmed, currentStatus: status };
    stubOrderApi();
    renderOrder();
    await heading();

    expect(screen.queryByRole("button", { name: "Cancel order" })).toBeNull();
  });

  it("points to the order list when the order doesn't exist", async () => {
    stubOrderApi({ [GET_ORDER]: () => json(404, { message: "Not found." }) });
    renderOrder();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No order by that number. Check your orders.")).toBeTruthy();
    expect(within(alert).getByRole("link", { name: "Your orders" }).getAttribute("href")).toBe("/account/orders");
    expect(within(alert).queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers a retry when the order fails to load", async () => {
    let fail = true;
    stubOrderApi({ [GET_ORDER]: () => (fail ? json(500, { message: "nope" }) : json(200, order)) });
    const user = userEvent.setup();
    renderOrder();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't find that order. Not my fault.")).toBeTruthy();
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await heading()).toBeTruthy();
  });

  it("links back to the admin order list from the admin route", async () => {
    stubOrderApi();
    renderWithProviders(
      <Routes>
        <Route path="/admin/orders/:id" element={<OrderDetailsPage backTo="/admin/orders" backLabel="All orders" />} />
      </Routes>,
      { route: `/admin/orders/${ORDER_ID}`, session: admin }
    );
    await heading();

    expect(screen.getByRole("link", { name: "All orders" }).getAttribute("href")).toBe("/admin/orders");
    expect(screen.queryByRole("link", { name: "All your orders" })).toBeNull();
  });
});
