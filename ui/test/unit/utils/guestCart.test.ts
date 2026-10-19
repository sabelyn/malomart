import { GUEST_CART_KEY, readGuestCart, subscribeGuestCart, writeGuestCart } from "@/utils/guestCart";

const SHIELD_ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const POTION_ID = "c3e8a1f2-7b4d-4e9a-8f1c-6d2b5a9e3f00";

const storageEvent = (key: string | null) => window.dispatchEvent(new StorageEvent("storage", { key }));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("readGuestCart", () => {
  it("reads the stored cart", () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ [SHIELD_ID]: 2 }));

    expect(readGuestCart()).toEqual({ [SHIELD_ID]: 2 });
  });

  it.each([
    ["corrupt JSON", "{not json"],
    ["a list", "[]"],
    ["an ID that isn't a UUID", JSON.stringify({ shield: 1 })],
    ["a quantity of zero", JSON.stringify({ [SHIELD_ID]: 0 })]
  ])("reads an empty cart from %s", (_, raw) => {
    localStorage.setItem(GUEST_CART_KEY, raw);

    expect(readGuestCart()).toEqual({});
  });

  it("returns the same cart until the stored one changes", () => {
    localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ [SHIELD_ID]: 1 }));
    const first = readGuestCart();

    expect(readGuestCart()).toBe(first);

    localStorage.setItem(GUEST_CART_KEY, JSON.stringify({ [SHIELD_ID]: 2 }));

    expect(readGuestCart()).not.toBe(first);
    expect(readGuestCart()).toEqual({ [SHIELD_ID]: 2 });
  });
});

describe("writeGuestCart", () => {
  it("stores the cart and removes it once it's empty", () => {
    writeGuestCart({ [SHIELD_ID]: 1, [POTION_ID]: 2 });

    expect(JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "")).toEqual({ [SHIELD_ID]: 1, [POTION_ID]: 2 });
    expect(readGuestCart()).toEqual({ [SHIELD_ID]: 1, [POTION_ID]: 2 });

    writeGuestCart({});

    expect(localStorage.getItem(GUEST_CART_KEY)).toBeNull();
    expect(readGuestCart()).toEqual({});
  });

  it("keeps the cart in memory when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage is disabled.");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage is disabled.");
    });

    expect(() => writeGuestCart({ [SHIELD_ID]: 1 })).not.toThrow();
    expect(readGuestCart()).toEqual({ [SHIELD_ID]: 1 });
  });
});

describe("subscribeGuestCart", () => {
  it("notifies about writes and about changes from other tabs until unsubscribed", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeGuestCart(listener);

    writeGuestCart({ [SHIELD_ID]: 1 });
    storageEvent(GUEST_CART_KEY);
    storageEvent(null);

    expect(listener).toHaveBeenCalledTimes(3);

    storageEvent("something-else");

    expect(listener).toHaveBeenCalledTimes(3);

    unsubscribe();
    writeGuestCart({});
    storageEvent(GUEST_CART_KEY);

    expect(listener).toHaveBeenCalledTimes(3);
  });
});
