import type { OrderOverview } from "@mm/lib/orders";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AdminOrdersSection from "@/pages/admin/AdminOrdersSection";
import { admin, json, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const ORDER_ID = "6b20c73c-4f92-4e45-b156-a95deeed1258";
const OTHER_ID = "27b6aa27-ef37-404a-8345-868db59d3793";

const overview = (id: string, overrides: Partial<OrderOverview> = {}): OrderOverview => ({
  id,
  customerId: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  orderDate: "2026-10-15T16:00:00.000Z",
  currentStatus: "Placed",
  recipient: "Link",
  total: 140,
  itemCount: 3,
  ...overrides
});

const FIRST_PAGE = "GET /api/orders?limit=25";
const NEXT_PAGE = "GET /api/orders?cursor=page-2&limit=25";

const page = (data: OrderOverview[], cursor?: string) =>
  json(200, { data, pagination: { limit: 25, hasNext: cursor !== undefined, cursor } });

const renderOrders = () => renderWithProviders(<AdminOrdersSection />, { route: "/admin/orders", session: admin });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminOrdersSection", () => {
  it("lists every customer's orders with who they're for and links to the admin order page", async () => {
    stubApi({
      "GET /api/orders?limit=25": () =>
        page([overview(ORDER_ID), overview(OTHER_ID, { recipient: "Malon", currentStatus: "Shipped" })])
    });
    renderWithProviders(<AdminOrdersSection />, { route: "/admin/orders", session: admin });

    const link = await screen.findByRole("link", { name: "Order 6B20C73C" });

    expect(link.getAttribute("href")).toBe(`/admin/orders/${ORDER_ID}`);
    expect(screen.getByText(/^For Malon\. Placed/)).toBeTruthy();
    expect(screen.getByText("Showing 2 orders.")).toBeTruthy();
    expect(document.title).toBe("Orders · Back office · Malo Mart");
  });

  it("filters by status", async () => {
    const fetch = stubApi({
      "GET /api/orders?limit=25": () => page([overview(ORDER_ID)]),
      "GET /api/orders?limit=25&status=Shipped": () => page([])
    });
    const user = userEvent.setup();
    renderWithProviders(<AdminOrdersSection />, { route: "/admin/orders", session: admin });
    await screen.findByRole("link", { name: "Order 6B20C73C" });

    await user.click(screen.getByRole("radio", { name: "Shipped" }));

    expect(await screen.findByText("No orders found.")).toBeTruthy();
    await waitFor(() => expect(requestsTo(fetch, "GET /api/orders?limit=25&status=Shipped")).toHaveLength(1));
  });

  it("loads the next page and says the first one was only the newest", async () => {
    const fetch = stubApi({
      [FIRST_PAGE]: () => page([overview(ORDER_ID)], "page-2"),
      [NEXT_PAGE]: () => page([overview(OTHER_ID, { recipient: "Malon" })])
    });
    const user = userEvent.setup();
    renderOrders();

    expect(await screen.findByText("Showing the newest 1 order.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Show more" }));

    const next = await screen.findByRole("link", { name: "Order 27B6AA27" });
    await waitFor(() => expect(document.activeElement).toBe(next));
    expect(screen.getByRole("status").textContent).toBe("Showing 2 orders.");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
    expect(requestsTo(fetch, NEXT_PAGE)).toHaveLength(1);
  });

  it("keeps the loaded orders when the next page fails and loads it on another try", async () => {
    let fail = true;
    stubApi({
      [FIRST_PAGE]: () => page([overview(ORDER_ID)], "page-2"),
      [NEXT_PAGE]: () => (fail ? json(500, { message: "nope" }) : page([overview(OTHER_ID)]))
    });
    const user = userEvent.setup();
    renderOrders();

    await user.click(await screen.findByRole("button", { name: "Show more" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't load more. Try again.");
    expect(screen.getByRole("link", { name: "Order 6B20C73C" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing the newest 1 order.");

    fail = false;
    await user.click(screen.getByRole("button", { name: "Show more" }));

    expect(await screen.findByRole("link", { name: "Order 27B6AA27" })).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says when there are no orders at all", async () => {
    stubApi({ [FIRST_PAGE]: () => page([]) });
    renderOrders();

    expect(await screen.findByText("No orders found.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("offers a retry when loading fails", async () => {
    let fail = true;
    stubApi({ [FIRST_PAGE]: () => (fail ? json(500, { message: "nope" }) : page([overview(ORDER_ID)])) });
    const user = userEvent.setup();
    renderOrders();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Couldn't load orders.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("");

    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("link", { name: "Order 6B20C73C" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing 1 order.");
  });
});
