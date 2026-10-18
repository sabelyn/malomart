import { ApiRequestError } from "@mm/lib/api";

import { formatRupees } from "@/components/product/PriceTag";

export const shippingCostLabel = (cost: number) => (cost === 0 ? "Free" : `${formatRupees(cost)} rupees`);

export const itemsLabel = (count: number) => `${count} ${count === 1 ? "item" : "items"}`;

export const isStaleOrder = (err: unknown) =>
  err instanceof ApiRequestError && (err.status === 404 || err.status === 409);

export const orderErrorMessage = (err: unknown) => {
  if (isStaleOrder(err)) {
    return "Something changed while you were looking. I updated everything, so check it over and try again.";
  }
  if (err instanceof ApiRequestError && err.status === 400) {
    return "Something's off with your order. Check your address and card, then try again.";
  }
  return "Couldn't place your order. Try again.";
};
