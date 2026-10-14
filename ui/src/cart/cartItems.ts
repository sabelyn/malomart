import type { CartItems } from "./guestCart";

type StockedProduct = { id: string; stockCount: number };

export const isEmptyCart = (items: Record<string, number>) => Object.keys(items).length === 0;

export const countItems = (items: CartItems) => Object.values(items).reduce((total, amount) => total + amount, 0);

export const addItems = (base: CartItems, extra: CartItems): CartItems => {
  const merged = { ...base };
  for (const [id, amount] of Object.entries(extra)) {
    merged[id] = (merged[id] ?? 0) + amount;
  }
  return merged;
};

export const applyQuantities = (items: CartItems, quantities: Record<string, number>): CartItems => {
  const next = { ...items };
  for (const [id, amount] of Object.entries(quantities)) {
    if (amount > 0) {
      next[id] = amount;
    } else {
      delete next[id];
    }
  }
  return next;
};

export const stockAdjustments = (items: CartItems, products: StockedProduct[]) => {
  const stock = new Map(products.map(({ id, stockCount }) => [id, stockCount]));
  const changes: Record<string, number> = {};
  for (const [id, amount] of Object.entries(items)) {
    const available = stock.get(id) ?? 0;
    if (amount > available) {
      changes[id] = available;
    }
  }
  return changes;
};
