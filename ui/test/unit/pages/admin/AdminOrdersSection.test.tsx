import type { OrderOverview } from "@mm/lib/orders";
import { screen, waitFor } from "@testing-library/react";
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

const page = (data: OrderOverview[]) => json(200, { data, pagination: { limit: 25, hasNext: false } });

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
});
