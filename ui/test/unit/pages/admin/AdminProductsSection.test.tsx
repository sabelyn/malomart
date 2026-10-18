import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import AdminProductsSection from "@/pages/admin/AdminProductsSection";
import { admin, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const SHIELD_ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const POTION_ID = "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00";
const LIST = "GET /api/products?limit=50";

const shield: ProductOverview = {
  id: SHIELD_ID,
  title: "Hylian Shield",
  category: "Shields",
  price: 200,
  originalPrice: 250,
  stockCount: 2,
  thumbnailKey: `products/${SHIELD_ID}/front`
};

const potion: ProductOverview = {
  id: POTION_ID,
  title: "Red Potion",
  category: "Potions",
  price: 20,
  stockCount: 0
};

const page = (data: ProductOverview[]) => json(200, { data, pagination: { limit: 50, hasNext: false } });

const renderSection = (route = "/admin/products") =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/admin/products" element={<AdminProductsSection />} />
        <Route path="/admin/products/:id" element={<p>editor</p>} />
      </Routes>
      <LocationDisplay />
    </>,
    { route, session: admin }
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AdminProductsSection", () => {
  it("lists products with their price, stock, and a link to edit them", async () => {
    stubApi({ [LIST]: () => page([shield, potion]) });
    renderSection();

    const link = await screen.findByRole("link", { name: "Hylian Shield" });

    expect(link.getAttribute("href")).toBe(`/admin/products/${SHIELD_ID}`);
    expect(screen.getByText(/Shields\. 200 rupees, down from 250\./).textContent).toBe(
      "Shields. 200 rupees, down from 250. 2 in stock."
    );
    expect(screen.getByText(/Potions\./).textContent).toBe("Potions. 20 rupees. Out of stock. No images.");
    expect(screen.getByText("Showing 2 products.")).toBeTruthy();
    expect(document.title).toBe("Products · Back office · Malo Mart");
  });

  it("links to the new product form", async () => {
    stubApi({ [LIST]: () => page([]) });
    renderSection();

    expect((await screen.findByRole("link", { name: "New product" })).getAttribute("href")).toBe("/admin/products/new");
    expect(await screen.findByText("No products found.")).toBeTruthy();
  });

  it("filters by category and stock", async () => {
    const fetch = stubApi({
      [LIST]: () => page([shield, potion]),
      "GET /api/products?limit=50&inStock=false": () => page([potion]),
      "GET /api/products?limit=50&category=Potions&inStock=false": () => page([potion])
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("link", { name: "Hylian Shield" });

    await user.click(screen.getByRole("radio", { name: "Out of stock" }));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Hylian Shield" })).toBeNull());
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "Potions");

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/products?inStock=false&category=Potions")
    );
    expect(requestsTo(fetch, "GET /api/products?limit=50&category=Potions&inStock=false")).toHaveLength(1);
  });

  it("deletes a product after confirming", async () => {
    let products = [shield, potion];
    const fetch = stubApi({
      [LIST]: () => page(products),
      [`DELETE /api/products/${POTION_ID}`]: () => {
        products = [shield];
        return new Response(null, { status: 204 });
      }
    });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "Delete Red Potion" }));
    const dialog = screen.getByRole("dialog", { name: "Delete Red Potion?" });
    await user.click(within(dialog).getByRole("button", { name: "Delete product" }));

    expect(await screen.findByText("Deleted Red Potion.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: "Red Potion" })).toBeNull());
    expect(requestsTo(fetch, `DELETE /api/products/${POTION_ID}`)).toHaveLength(1);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Products" })));
  });

  it("keeps the product when the delete is cancelled", async () => {
    const fetch = stubApi({ [LIST]: () => page([shield]) });
    const user = userEvent.setup();
    renderSection();

    await user.click(await screen.findByRole("button", { name: "Delete Hylian Shield" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Keep it" }));

    expect(screen.getByRole("link", { name: "Hylian Shield" })).toBeTruthy();
    expect(fetch.mock.calls.every(([, init]) => (init?.method ?? "GET") === "GET")).toBe(true);
  });
});
