import type { OrderOverview } from "@mm/lib/orders";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import OrdersSection from "@/pages/account/OrdersSection";
import { customer, json, LocationDisplay, renderWithProviders } from "../../../utils";

const overview = (id: string, overrides: Partial<OrderOverview> = {}): OrderOverview => ({
  id,
  customerId: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  orderDate: "2026-10-15T16:00:00.000Z",
  currentStatus: "Placed",
  total: 140,
  itemCount: 3,
  ...overrides
});

const SHIPPED_ID = "6b20c73c-4f92-4e45-b156-a95deeed1258";
const CANCELLED_ID = "27b6aa27-ef37-404a-8345-868db59d3793";

type Page = { data: OrderOverview[]; cursor?: string; status?: number };

const stubOrders = (respond: (query: URLSearchParams) => Page) => {
  const fetch = vi.fn<typeof globalThis.fetch>(input => {
    const url = new URL(String(input), "http://localhost");
    const { data, cursor, status = 200 } = respond(url.searchParams);
    return Promise.resolve(
      status === 200
        ? json(200, { data, pagination: { limit: 20, hasNext: cursor !== undefined, cursor } })
        : json(status, { message: "nope" })
    );
  });
  vi.stubGlobal("fetch", fetch);
  return () => fetch.mock.calls.map(([input]) => new URL(String(input), "http://localhost").searchParams);
};

const renderOrders = (route = "/account/orders") =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/account/orders" element={<OrdersSection />} />
      </Routes>
      <LocationDisplay />
    </>,
    { route, session: customer }
  );

const row = (number: string) => screen.getByRole("link", { name: `Order ${number}` }).closest("li") as HTMLElement;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OrdersSection", () => {
  it("lists orders with their status, date, item count, and total", async () => {
    stubOrders(() => ({
      data: [
        overview(SHIPPED_ID, { currentStatus: "Shipped", total: 120, itemCount: 2 }),
        overview(CANCELLED_ID, { currentStatus: "Cancelled", itemCount: 1 })
      ]
    }));
    renderOrders();

    const link = await screen.findByRole("link", { name: "Order 6B20C73C" });

    expect(link.getAttribute("href")).toBe(`/orders/${SHIPPED_ID}`);
    expect(screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent)).toEqual([
      "Order 6B20C73CStatus: Shipped",
      "Order 27B6AA27Status: Cancelled"
    ]);
    expect(within(row("6B20C73C")).getByText("Placed October 15, 2026. 2 items.")).toBeTruthy();
    expect(within(row("6B20C73C")).getByText("120 rupees")).toBeTruthy();
    expect(within(row("27B6AA27")).getByText("Placed October 15, 2026. 1 item.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing 2 orders.");
    expect(document.title).toBe("Orders · Malo Mart");
  });

  it("filters by status through the URL", async () => {
    const requests = stubOrders(query =>
      query.get("status") === "Shipped"
        ? { data: [overview(SHIPPED_ID, { currentStatus: "Shipped" })] }
        : { data: [overview(CANCELLED_ID)] }
    );
    const user = userEvent.setup();
    renderOrders();
    await screen.findByRole("link", { name: "Order 27B6AA27" });

    await user.click(screen.getByRole("radio", { name: "Shipped" }));

    expect(await screen.findByRole("link", { name: "Order 6B20C73C" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/account/orders?status=Shipped");
    expect(requests().at(-1)?.get("status")).toBe("Shipped");
    expect(screen.getByRole("status").textContent).toBe("Showing 1 shipped order.");
  });

  it("loads the next page and moves focus to the first new order", async () => {
    const requests = stubOrders(query =>
      query.get("cursor") === "page-2"
        ? { data: [overview(CANCELLED_ID)] }
        : { data: [overview(SHIPPED_ID)], cursor: "page-2" }
    );
    const user = userEvent.setup();
    renderOrders();

    await user.click(await screen.findByRole("button", { name: "Show more" }));

    const next = await screen.findByRole("link", { name: "Order 27B6AA27" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect(requests().at(-1)?.get("cursor")).toBe("page-2");
    expect(screen.getByRole("status").textContent).toBe("Showing 2 orders.");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("points to the catalog when there are no orders", async () => {
    stubOrders(() => ({ data: [] }));
    renderOrders();

    expect(await screen.findByText("No orders yet. The shelves aren't going to empty themselves.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Browse the catalog" }).getAttribute("href")).toBe("/products");
  });

  it("says when no orders match the status filter", async () => {
    stubOrders(() => ({ data: [] }));
    renderOrders("/account/orders?status=Delivered");

    expect(await screen.findByText("Nothing delivered. Try another.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Browse the catalog" })).toBeNull();
  });

  it("offers a retry when loading fails", async () => {
    let fail = true;
    stubOrders(() => (fail ? { data: [], status: 500 } : { data: [overview(SHIPPED_ID)] }));
    const user = userEvent.setup();
    renderOrders();

    const alert = await screen.findByRole("alert");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Order 6B20C73C" })).toBeTruthy();
  });
});
