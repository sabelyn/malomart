import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { sessionKey } from "@/api";
import { useCart } from "@/components/cart/CartProvider";
import { GUEST_CART_KEY } from "@/utils/guestCart";
import { announced, customer, json, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const CUSTOMER_ID = "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d";
const GET_CUSTOMER = "GET /api/customers";
const SAVE = "PUT /api/customers/cart";

const shield = { id: "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01", title: "Hylian Shield", stockCount: 5 };
const potion = { id: "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00", title: "Red Potion", stockCount: 2 };

type Cart = Record<string, number>;

const customerResponse = (cart: Cart) =>
  json(200, { id: CUSTOMER_ID, defaultAddress: null, defaultPaymentMethod: null, cart });

const CartProbe = () => {
  const cart = useCart();
  return (
    <>
      <p data-testid="items">{JSON.stringify(cart.items)}</p>
      <p data-testid="adjustments">{JSON.stringify(cart.adjustments)}</p>
      <p data-testid="ready">{String(cart.ready)}</p>
      <p data-testid="load-failed">{String(cart.loadFailed)}</p>
      <button onClick={() => cart.add(shield)}>Add shield</button>
      <button onClick={() => cart.setQuantity(shield.id, 3)}>Three shields</button>
      <button onClick={() => cart.setQuantity(shield.id, 4)}>Four shields</button>
      <button onClick={() => cart.adjust({ [shield.id]: 1 })}>Only one shield left</button>
      <button onClick={cart.retryLoad}>Reload cart</button>
    </>
  );
};

const renderCart = (signedIn: boolean) =>
  renderWithProviders(<CartProbe />, { session: signedIn ? customer : null, withCart: true });

const shown = (testId: string) => JSON.parse(screen.getByTestId(testId).textContent ?? "") as unknown;
const setGuestCart = (items: Cart) => localStorage.setItem(GUEST_CART_KEY, JSON.stringify(items));
const guestCart = () => JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "{}") as Cart;

const storageEvent = (key: string | null) =>
  act(() => {
    window.dispatchEvent(new StorageEvent("storage", { key }));
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CartProvider", () => {
  it("follows guest cart changes made in other tabs", () => {
    setGuestCart({ [shield.id]: 1 });
    renderCart(false);

    expect(shown("items")).toEqual({ [shield.id]: 1 });

    setGuestCart({ [shield.id]: 1, [potion.id]: 2 });
    storageEvent(GUEST_CART_KEY);

    expect(shown("items")).toEqual({ [shield.id]: 1, [potion.id]: 2 });

    localStorage.clear();
    storageEvent(null);

    expect(shown("items")).toEqual({});
  });

  it("adds to a signed-in customer's saved cart and announces the new count", async () => {
    const fetch = stubApi({ [GET_CUSTOMER]: () => customerResponse({ [potion.id]: 1 }), [SAVE]: () => json(200, {}) });
    const user = userEvent.setup();
    renderCart(true);

    await waitFor(() => expect(shown("ready")).toBe(true));
    await user.click(screen.getByRole("button", { name: "Add shield" }));

    expect(shown("items")).toEqual({ [potion.id]: 1, [shield.id]: 1 });
    expect(announced()).toBe("Added Hylian Shield to your cart. 1 in cart.");
    await waitFor(() => expect(requestsTo(fetch, SAVE)).toEqual([{ [potion.id]: 1, [shield.id]: 1 }]));
    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
  });

  it("asks shoppers to wait when they add before the saved cart loads", async () => {
    const fetch = stubApi({ [GET_CUSTOMER]: () => new Promise<Response>(() => undefined) });
    const user = userEvent.setup();
    renderCart(true);

    await user.click(screen.getByRole("button", { name: "Add shield" }));

    expect(shown("ready")).toBe(false);
    expect(announced()).toBe("Your cart is still loading. Try again in a moment.");
    expect(requestsTo(fetch, SAVE)).toHaveLength(0);
  });

  it("keeps the latest change when an earlier save fails while another is waiting", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    let failFirstSave = (_: Response) => {};
    const fetch = stubApi({
      [GET_CUSTOMER]: () => customerResponse({ [shield.id]: 1 }),
      [SAVE]: () =>
        requestsTo(fetch, SAVE).length === 1
          ? new Promise<Response>(resolve => {
              failFirstSave = resolve;
            })
          : json(200, {})
    });
    const user = userEvent.setup();
    renderCart(true);

    await waitFor(() => expect(shown("ready")).toBe(true));
    await user.click(screen.getByRole("button", { name: "Three shields" }));
    await user.click(screen.getByRole("button", { name: "Four shields" }));
    await waitFor(() => expect(requestsTo(fetch, SAVE)).toHaveLength(1));
    await act(() => {
      failFirstSave(json(500, { message: "boom" }));
      return Promise.resolve();
    });

    await waitFor(() => expect(requestsTo(fetch, SAVE)).toEqual([{ [shield.id]: 3 }, { [shield.id]: 4 }]));
    expect(announced("assertive")).toBe("Couldn't save your cart. It's back to how it was. Try again.");
    expect(shown("items")).toEqual({ [shield.id]: 4 });
    expect(requestsTo(fetch, GET_CUSTOMER)).toHaveLength(1);
  });

  it("keeps the guest cart when merging it into the saved cart fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    setGuestCart({ [shield.id]: 1 });
    const fetch = stubApi({
      [GET_CUSTOMER]: () => customerResponse({ [potion.id]: 1 }),
      [SAVE]: () => json(500, { message: "boom" })
    });
    renderCart(true);

    await waitFor(() => expect(requestsTo(fetch, SAVE)).toEqual([{ [potion.id]: 1, [shield.id]: 1 }]));
    await waitFor(() =>
      expect(announced("assertive")).toBe("Couldn't save your cart. It's back to how it was. Try again.")
    );
    await waitFor(() => expect(shown("items")).toEqual({ [potion.id]: 1 }));
    expect(guestCart()).toEqual({ [shield.id]: 1 });
  });

  it("drops stock adjustments made before signing in", async () => {
    setGuestCart({ [shield.id]: 3 });
    stubApi({ [GET_CUSTOMER]: () => customerResponse({ [potion.id]: 1 }) });
    const user = userEvent.setup();
    const { queryClient } = renderCart(false);

    await user.click(screen.getByRole("button", { name: "Only one shield left" }));

    expect(guestCart()).toEqual({ [shield.id]: 1 });
    expect(shown("adjustments")).toEqual({ [shield.id]: 1 });

    localStorage.clear();
    act(() => {
      queryClient.setQueryData(sessionKey, customer);
    });

    await waitFor(() => expect(shown("items")).toEqual({ [potion.id]: 1 }));
    expect(shown("adjustments")).toEqual({});
  });

  it("reports a saved cart that failed to load and loads it again on request", async () => {
    let fail = true;
    stubApi({
      [GET_CUSTOMER]: () => (fail ? json(500, { message: "nope" }) : customerResponse({ [potion.id]: 2 }))
    });
    const user = userEvent.setup();
    renderCart(true);

    await waitFor(() => expect(shown("load-failed")).toBe(true));
    expect(shown("ready")).toBe(false);

    fail = false;
    await user.click(screen.getByRole("button", { name: "Reload cart" }));

    await waitFor(() => expect(shown("items")).toEqual({ [potion.id]: 2 }));
    expect(shown("load-failed")).toBe(false);
    expect(shown("ready")).toBe(true);
  });
});
