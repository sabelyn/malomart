import type { ProductOverview } from "@mm/lib/products";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import CartPage from "@/pages/CartPage";
import { GUEST_CART_KEY } from "@/utils/guestCart";
import { announced, customer, json, renderWithProviders, toasts } from "../../utils";

const CUSTOMER_ID = "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d";
const MISSING_ID = "0f0e0d0c-0b0a-4908-8706-050403020100";

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

type Cart = Record<string, number>;

type StubOptions = {
  serverCart?: Cart;
  onSave?: (body: Cart) => Response;
};

const stubCartApi = ({ serverCart = {}, onSave = () => json(200, {}) }: StubOptions = {}) => {
  const saves: Cart[] = [];
  const fetch = vi.fn<typeof globalThis.fetch>((input, init) => {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    if (method === "GET" && url.pathname === "/api/products/batch") {
      const ids = url.searchParams.get("ids")?.split(",") ?? [];
      return Promise.resolve(
        json(
          200,
          catalog.filter(product => ids.includes(product.id))
        )
      );
    }
    if (method === "GET" && url.pathname === "/api/customers") {
      return Promise.resolve(
        json(200, { id: CUSTOMER_ID, defaultAddress: null, defaultPaymentMethod: null, cart: serverCart })
      );
    }
    if (method === "PUT" && url.pathname === "/api/customers/cart") {
      const body = JSON.parse(String(init?.body)) as Cart;
      saves.push(body);
      return Promise.resolve(onSave(body));
    }
    return Promise.reject(new Error(`Unexpected request: ${method} ${String(input)}`));
  });
  vi.stubGlobal("fetch", fetch);
  return { fetch, saves };
};

const setGuestCart = (items: Cart) => localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
const guestCart = () => JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}") as Cart;

const renderCart = (signedIn = false) =>
  renderWithProviders(
    <Routes>
      <Route path="/cart" element={<CartPage />} />
    </Routes>,
    { route: "/cart", session: signedIn ? customer : null, withCart: true }
  );

const quantity = (title: string) => screen.getByRole("combobox", { name: `Quantity of ${title}` });
const lineHeadings = () => screen.getAllByRole("heading", { level: 2 }).map(heading => heading.textContent);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CartPage", () => {
  it("sends shoppers back to the shelves when the cart is empty", () => {
    const { fetch } = stubCartApi();
    renderCart();

    expect(screen.getByRole("heading", { level: 1, name: "Your cart" })).toBeTruthy();
    expect(screen.getByText("Empty. That's not how a store works.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Go shopping" }).getAttribute("href")).toBe("/products");
    expect(fetch).not.toHaveBeenCalled();
    expect(document.title).toBe("Cart · Malo Mart");
  });

  it("lists a guest's items with totals and asks them to sign in or sign up to check out", async () => {
    setGuestCart({ [shield.id]: 2, [potion.id]: 1 });
    stubCartApi();
    renderCart();

    expect(await screen.findByRole("heading", { level: 2, name: "Hylian Shield" })).toBeTruthy();
    expect(lineHeadings()).toEqual(["Hylian Shield", "Red Potion", "Summary"]);
    expect((quantity("Hylian Shield") as HTMLSelectElement).value).toBe("2");
    expect(screen.getByText("Subtotal: 420 rupees")).toBeTruthy();
    const summary = screen.getByRole("region", { name: "Summary" });
    expect(summary.textContent).toContain("420 rupees");
    expect(screen.queryByRole("link", { name: "Proceed to checkout" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in to check out" }).getAttribute("href")).toBe(
      `/auth/sign-in?${new URLSearchParams({ returnTo: "/cart" })}`
    );
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href")).toBe(
      `/auth/sign-up?${new URLSearchParams({ returnTo: "/cart" })}`
    );
  });

  it("offers checkout to signed-in customers from their saved cart", async () => {
    stubCartApi({ serverCart: { [potion.id]: 1 } });
    renderCart(true);

    expect(await screen.findByRole("heading", { level: 2, name: "Red Potion" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Proceed to checkout" }).getAttribute("href")).toBe("/checkout");
    expect(screen.queryByRole("link", { name: "Sign in to check out" })).toBeNull();
  });

  it("only offers quantities up to the stock on hand", async () => {
    setGuestCart({ [potion.id]: 1 });
    stubCartApi();
    renderCart();

    await screen.findByRole("heading", { level: 2, name: "Red Potion" });

    const options = within(quantity("Red Potion")).getAllByRole("option");
    expect(options.map(option => option.textContent)).toEqual(["1", "2"]);
  });

  it("saves a guest's quantity change to local storage", async () => {
    setGuestCart({ [potion.id]: 1 });
    stubCartApi();
    const user = userEvent.setup();
    renderCart();

    await screen.findByRole("heading", { level: 2, name: "Red Potion" });
    await user.selectOptions(quantity("Red Potion"), "2");

    expect(guestCart()).toEqual({ [potion.id]: 2 });
    expect(screen.getByText("Subtotal: 40 rupees")).toBeTruthy();
  });

  it("saves a signed-in customer's quantity change to the server", async () => {
    const { saves } = stubCartApi({ serverCart: { [shield.id]: 1, [potion.id]: 1 } });
    const user = userEvent.setup();
    renderCart(true);

    await screen.findByRole("heading", { level: 2, name: "Hylian Shield" });
    await user.selectOptions(quantity("Hylian Shield"), "4");

    await waitFor(() => expect(saves).toEqual([{ [shield.id]: 4, [potion.id]: 1 }]));
    expect(screen.getByText("Subtotal: 820 rupees")).toBeTruthy();
    expect(guestCart()).toEqual({});
  });

  it("removes an item, announces it, and moves focus to the heading", async () => {
    setGuestCart({ [shield.id]: 1, [potion.id]: 1 });
    stubCartApi();
    const user = userEvent.setup();
    renderCart();

    await screen.findByRole("heading", { level: 2, name: "Red Potion" });
    await user.click(screen.getByRole("button", { name: "Remove Red Potion" }));

    expect(screen.queryByRole("heading", { level: 2, name: "Red Potion" })).toBeNull();
    expect(guestCart()).toEqual({ [shield.id]: 1 });
    expect(announced()).toBe("Removed Red Potion from your cart.");
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Your cart" }));
  });

  it("lowers quantities past the stock on hand and drops products that are gone", async () => {
    setGuestCart({ [potion.id]: 5, [MISSING_ID]: 1 });
    stubCartApi();
    const user = userEvent.setup();
    renderCart();

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Red Potion: only 2 left, so that's what you get.")).toBeTruthy();
    expect(within(alert).getByText("Something in your cart isn't sold anymore, so I took it out.")).toBeTruthy();
    expect(guestCart()).toEqual({ [potion.id]: 2 });
    expect((quantity("Red Potion") as HTMLSelectElement).value).toBe("2");

    await user.click(within(alert).getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("merges a guest cart into the saved cart after signing in", async () => {
    setGuestCart({ [shield.id]: 1, [potion.id]: 1 });
    const { saves } = stubCartApi({ serverCart: { [shield.id]: 2 } });
    renderCart(true);

    await waitFor(() => expect(saves).toEqual([{ [shield.id]: 3, [potion.id]: 1 }]));
    await waitFor(() => expect(guestCart()).toEqual({}));
    expect((quantity("Hylian Shield") as HTMLSelectElement).value).toBe("3");
    expect(screen.getByText("Subtotal: 620 rupees")).toBeTruthy();
  });

  it("explains quantities the server lowered to match stock", async () => {
    setGuestCart({ [potion.id]: 2 });
    stubCartApi({
      serverCart: { [potion.id]: 1 },
      onSave: () => json(200, { [potion.id]: 2 })
    });
    renderCart(true);

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Red Potion: only 2 left, so that's what you get.")).toBeTruthy();
    expect((quantity("Red Potion") as HTMLSelectElement).value).toBe("2");
  });

  it("puts the cart back and says so when saving fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    stubCartApi({
      serverCart: { [shield.id]: 1 },
      onSave: () => json(500, { message: "boom" })
    });
    const user = userEvent.setup();
    renderCart(true);

    await screen.findByRole("heading", { level: 2, name: "Hylian Shield" });
    await user.selectOptions(quantity("Hylian Shield"), "3");

    await waitFor(() =>
      expect(announced("assertive")).toBe("Couldn't save your cart. It's back to how it was. Try again.")
    );
    expect(toasts()).toHaveLength(1);
    await waitFor(() => expect((quantity("Hylian Shield") as HTMLSelectElement).value).toBe("1"));
  });
});
