import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Outlet, Route, Routes } from "react-router";

import CatalogPage from "@/pages/CatalogPage";
import { json, LocationDisplay, renderWithProviders } from "../../utils";

const overview = (title: string, overrides: Partial<ProductOverview> = {}): ProductOverview => ({
  id: crypto.randomUUID(),
  title,
  price: 50,
  stockCount: 5,
  ...overrides
});

type Page = { data: ProductOverview[]; cursor?: string };

const stubProducts = (respond: (query: URLSearchParams) => Page) => {
  const fetch = vi.fn<typeof globalThis.fetch>(input => {
    const url = new URL(String(input), "http://localhost");
    const { data, cursor } = respond(url.searchParams);
    return Promise.resolve(json(200, { data, pagination: { limit: 24, hasNext: cursor !== undefined, cursor } }));
  });
  vi.stubGlobal("fetch", fetch);
  return () => fetch.mock.calls.map(([input]) => new URL(String(input), "http://localhost").searchParams);
};

const renderCatalog = (route = "/products") =>
  renderWithProviders(
    <>
      <Routes>
        <Route element={<Outlet context={{ addToCart: vi.fn() }} />}>
          <Route path="/products" element={<CatalogPage />} />
        </Route>
      </Routes>
      <LocationDisplay />
    </>,
    { route, session: null }
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CatalogPage", () => {
  it("lists products with links to their pages", async () => {
    stubProducts(() => ({ data: [overview("Hylian Shield"), overview("Red Potion")] }));
    renderCatalog();

    const link = await screen.findByRole("link", { name: "Hylian Shield" });

    expect(link.getAttribute("href")).toMatch(/^\/products\/[\w-]+$/);
    expect(screen.getByRole("status").textContent).toBe("Showing 2 products.");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("filters by category and stock through the URL", async () => {
    const requests = stubProducts(query =>
      query.get("category") === "Shields" ? { data: [overview("Hylian Shield")] } : { data: [overview("Red Potion")] }
    );
    const user = userEvent.setup();
    renderCatalog();
    await screen.findByRole("link", { name: "Red Potion" });

    await user.click(screen.getByRole("radio", { name: "Shields" }));
    await user.click(screen.getByRole("checkbox", { name: "Hide sold-out items" }));

    expect(await screen.findByRole("link", { name: "Hylian Shield" })).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/products?category=Shields&inStock=true");
    expect(requests().at(-1)?.get("inStock")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Showing 1 product in Shields.");
  });

  it("loads the next page and moves focus to the first new product", async () => {
    const requests = stubProducts(query =>
      query.get("cursor") === "page-2"
        ? { data: [overview("Bombs")] }
        : { data: [overview("Arrows")], cursor: "page-2" }
    );
    const user = userEvent.setup();
    renderCatalog();

    await user.click(await screen.findByRole("button", { name: "Show more" }));

    const bombs = await screen.findByRole("link", { name: "Bombs" });
    await waitFor(() => expect(document.activeElement).toBe(bombs));
    expect(screen.getByRole("link", { name: "Arrows" })).toBeTruthy();
    expect(requests().at(-1)?.get("cursor")).toBe("page-2");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("tells the user when nothing matches", async () => {
    stubProducts(() => ({ data: [] }));
    renderCatalog("/products?category=Masks");

    expect(await screen.findByText("Nothing on that shelf. Try another.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("No products found.");
  });
});
