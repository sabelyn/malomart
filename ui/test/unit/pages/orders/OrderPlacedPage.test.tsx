import type { OrderDto } from "@mm/lib/orders";
import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import OrderPlacedPage from "@/pages/orders/OrderPlacedPage";
import { customer, json, renderWithProviders, stubApi } from "../../../utils";

const ORDER_ID = "6b20c73c-4f92-4e45-b156-a95deeed1258";
const ORDER_NUMBER = "6B20C73C";
const GET_ORDER = `GET /api/orders/${ORDER_ID}`;

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

const order: OrderDto = {
  id: ORDER_ID,
  customerId: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  products: {
    [shield.id]: { title: "Hylian Shield", amount: 2, pricePerUnit: 200 },
    [potion.id]: { title: "Red Potion", amount: 1, pricePerUnit: 20 }
  },
  currentStatus: "Placed",
  statusUpdates: { Placed: "2026-10-15T12:00:00.000Z" },
  orderDate: "2026-10-15T12:00:00.000Z",
  address: {
    recipient: "Malon",
    street: "2 Lon Lon Road",
    city: "Lon Lon Ranch",
    region: "Central Hyrule",
    postalCode: "22222"
  },
  shipping: { method: "Standard", cost: 0 },
  paymentMethod: { brand: "Hyrulean Express", lastFour: "4242" }
};

const renderPlaced = () =>
  renderWithProviders(
    <Routes>
      <Route path="/orders/:id/placed" element={<OrderPlacedPage />} />
    </Routes>,
    { route: `/orders/${ORDER_ID}/placed`, session: customer }
  );

const section = (name: string) => screen.getByRole("region", { name });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OrderPlacedPage", () => {
  it("celebrates the order and shows what was bought, where it's going, and the total", async () => {
    stubApi({
      [GET_ORDER]: () => json(200, order),
      [PRODUCTS]: () => json(200, [shield, potion])
    });
    renderPlaced();

    expect(await screen.findByRole("heading", { level: 1, name: "Sold! A purchase for the ages!" })).toBeTruthy();
    expect(document.title).toBe("Order placed · Malo Mart");
    expect(screen.getByText(`Order ${ORDER_NUMBER} is in. Now go away so I can pack it.`)).toBeTruthy();

    const details = section("The details");
    expect(within(details).getByText("Order number").nextElementSibling?.textContent).toBe(ORDER_NUMBER);
    expect(within(details).getByText("2 Lon Lon Road")).toBeTruthy();
    expect(within(details).getByText("Postman on Foot, 5 to 7 days. Free.")).toBeTruthy();
    expect(within(details).getByText("Hyrulean Express ending in 4242")).toBeTruthy();
    expect(within(details).getByText("Total").nextElementSibling?.textContent).toBe("420 rupees for 3 items");

    const items = section("What you bought");
    await waitFor(() => expect(within(items).getAllByRole("heading", { level: 3 })).toHaveLength(2));
    expect(within(items).getByRole("link", { name: "Hylian Shield" }).getAttribute("href")).toBe(
      `/products/${shield.id}`
    );
    expect(items.querySelector("img")?.getAttribute("src")).toContain("products/shield/front");

    expect(screen.getByRole("link", { name: "View order details" }).getAttribute("href")).toBe(`/orders/${ORDER_ID}`);
    expect(screen.getByRole("link", { name: "Keep shopping" }).getAttribute("href")).toBe("/products");
  });

  it("offers a retry when the order fails to load", async () => {
    let fail = true;
    stubApi({
      [GET_ORDER]: () => (fail ? json(500, { message: "nope" }) : json(200, order)),
      [PRODUCTS]: () => json(200, [shield, potion])
    });
    const user = userEvent.setup();
    renderPlaced();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't find that order. Not my fault.")).toBeTruthy();
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Sold! A purchase for the ages!" })).toBeTruthy();
  });

  it("points to the order list when the order doesn't exist", async () => {
    stubApi({ [GET_ORDER]: () => json(404, { message: "Not found." }) });
    renderPlaced();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("No order by that number. Check your orders.")).toBeTruthy();
    expect(within(alert).getByRole("link", { name: "Your orders" }).getAttribute("href")).toBe("/account/orders");
  });
});
