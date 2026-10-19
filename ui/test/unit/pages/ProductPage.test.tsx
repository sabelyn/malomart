import type { ProductDto } from "@mm/lib/products";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import ProductPage from "@/pages/ProductPage";
import { GUEST_CART_KEY } from "@/utils/guestCart";
import { admin, announced, json, renderWithProviders, stubApi, toasts } from "../../utils";

const ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";

const product: ProductDto = {
  id: ID,
  title: "Hylian Shield",
  description: "Sturdy, fireproof, and no longer priced like a castle.",
  category: "Shields",
  price: 200,
  originalPrice: 250,
  stockCount: 2,
  thumbnailKey: `products/${ID}/front`,
  imageKeys: [`products/${ID}/back`, `products/${ID}/front`],
  features: ["Fireproof", "Blocks Guardian lasers with good timing"]
};

const renderProduct = (id = ID, session: typeof admin | null = null) =>
  renderWithProviders(
    <Routes>
      <Route path="/products/:id" element={<ProductPage />} />
    </Routes>,
    { route: `/products/${id}`, session, withCart: true }
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProductPage", () => {
  it("shows the product with a breadcrumb back to its category", async () => {
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, product) });
    renderProduct();

    expect(await screen.findByRole("heading", { level: 1, name: "Hylian Shield" })).toBeTruthy();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb.querySelector('a[href="/products?category=Shields"]')).toBeTruthy();
    expect(screen.getByText("2 left. Decide.")).toBeTruthy();
    expect(screen.getByText("20% off? Why not!")).toBeTruthy();
    expect(screen.getAllByRole("listitem").map(item => item.textContent)).toContain("Fireproof");
    expect(document.title).toBe("Hylian Shield · Malo Mart");
    expect(screen.queryByRole("link", { name: "Edit product" })).toBeNull();
  });

  it("links admins to the product's editor", async () => {
    stubApi({
      [`GET /api/products/${ID}`]: () => json(200, product),
      "GET /api/customers": () =>
        json(200, { id: admin.id, defaultAddress: null, defaultPaymentMethod: null, cart: {} })
    });
    renderProduct(ID, admin);

    expect((await screen.findByRole("link", { name: "Edit product" })).getAttribute("href")).toBe(
      `/admin/products/${ID}`
    );
  });

  it("starts the gallery on the thumbnail and switches images", async () => {
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, product) });
    const user = userEvent.setup();
    renderProduct();

    const first = await screen.findByRole("img", { name: "Hylian Shield, image 1 of 2" });
    expect(first.getAttribute("src")).toBe(`/images/products/${ID}/front-320.webp`);

    await user.click(screen.getByRole("button", { name: "Show image 2 of 2" }));

    const second = screen.getByRole("img", { name: "Hylian Shield, image 2 of 2" });
    expect(second.getAttribute("src")).toBe(`/images/products/${ID}/back-320.webp`);
    expect(screen.getByRole("button", { name: "Show image 2 of 2" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("adds the product to the guest cart and announces it", async () => {
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, product) });
    const user = userEvent.setup();
    renderProduct();

    await user.click(await screen.findByRole("button", { name: "Add to cart" }));

    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}")).toEqual({ [ID]: 1 });
    expect(announced()).toBe("Added Hylian Shield to your cart. 1 in cart.");
    expect(toasts()).toEqual(["Added Hylian Shield to your cart. 1 in cart."]);
  });

  it("swaps to quantity buttons after adding and moves focus between them", async () => {
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, product) });
    const user = userEvent.setup();
    renderProduct();

    await user.click(await screen.findByRole("button", { name: "Add to cart" }));

    const more = screen.getByRole("button", { name: "Add one more Hylian Shield" });
    expect(document.activeElement).toBe(more);
    expect(screen.getByText("1 in cart")).toBeTruthy();

    await user.click(more);

    expect(screen.getByText("2 in cart")).toBeTruthy();
    expect(announced()).toBe("Added Hylian Shield to your cart. 2 in cart.");
    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}")).toEqual({ [ID]: 2 });

    const fewer = screen.getByRole("button", { name: "Remove one Hylian Shield" });
    await user.click(fewer);

    expect(screen.getByText("1 in cart")).toBeTruthy();
    expect(announced()).toBe("Removed one Hylian Shield from your cart. 1 in cart.");

    await user.click(fewer);

    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}")).toEqual({});
    expect(announced()).toBe("Removed Hylian Shield from your cart.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add to cart" }));
  });

  it("won't add more than the stock on hand", async () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ [ID]: 2 }));
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, product) });
    const user = userEvent.setup();
    renderProduct();

    const more = await screen.findByRole("button", { name: "Add one more Hylian Shield" });
    expect(more.getAttribute("aria-disabled")).toBe("true");

    await user.click(more);

    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}")).toEqual({ [ID]: 2 });
    expect(announced()).toBe("Your cart already has every Hylian Shield in stock.");
  });

  it("disables adding a sold-out product", async () => {
    stubApi({ [`GET /api/products/${ID}`]: () => json(200, { ...product, stockCount: 0 }) });
    renderProduct();

    const button = await screen.findByRole("button", { name: "Add to cart" });

    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("Sold out. Should've been faster.")).toBeTruthy();
  });

  it("shows not found when the product doesn't exist", async () => {
    stubApi({
      [`GET /api/products/${ID}`]: () => json(404, { code: "NOT_FOUND", message: "Product not found." })
    });
    renderProduct();

    expect(await screen.findByRole("heading", { level: 1, name: "Not on the shelves" })).toBeTruthy();
    expect(document.title).toBe("Product not found · Malo Mart");
  });

  it("shows not found for a malformed ID without calling the API", () => {
    const fetch = stubApi({});
    renderProduct("not-an-id");

    expect(screen.getByRole("heading", { level: 1, name: "Not on the shelves" })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });
});
