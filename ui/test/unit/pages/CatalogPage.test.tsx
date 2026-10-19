import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import CatalogPage from "@/pages/CatalogPage";
import { json, LocationDisplay, renderWithProviders } from "../../utils";

const overview = (title: string, overrides: Partial<ProductOverview> = {}): ProductOverview => ({
  id: crypto.randomUUID(),
  title,
  category: "Misc",
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
        <Route path="/products" element={<CatalogPage />} />
      </Routes>
      <LocationDisplay />
    </>,
    { route, session: null, withCart: true }
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
    expect(screen.getByRole("region", { name: "Products" })).toBeTruthy();
    expect(screen.getAllByRole("heading").map(heading => `${heading.tagName} ${heading.textContent}`)).toEqual([
      "H1 Catalog",
      "H2 Products",
      "H3 Hylian Shield",
      "H3 Red Potion"
    ]);
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

  it("shows each product's category only when no category is selected", async () => {
    stubProducts(query =>
      query.get("category") === "Shields"
        ? { data: [overview("Hylian Shield", { category: "Shields" })] }
        : { data: [overview("Red Potion", { category: "Potions" })] }
    );
    const user = userEvent.setup();
    renderCatalog();

    const potion = await screen.findByRole("article", { name: "Red Potion" });
    expect(within(potion).getByText("Potions")).toBeTruthy();

    await user.click(screen.getByRole("radio", { name: "Shields" }));

    const shield = await screen.findByRole("article", { name: "Hylian Shield" });
    expect(within(shield).queryByText("Shields")).toBeNull();
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
