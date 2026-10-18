import type { Order, OrderItemEntry } from "./types";

type OrderItems = Record<string, Pick<OrderItemEntry, "amount" | "pricePerUnit">>;

// Prices on this website are whole numbers, so no need to account for floating point addition
export const getOrderSubtotal = (items: OrderItems): number => {
  let total = 0;
  for (const { amount, pricePerUnit } of Object.values(items)) {
    total += amount * pricePerUnit;
  }

  return total;
};

export const getOrderItemCount = (items: OrderItems): number => {
  let count = 0;
  for (const { amount } of Object.values(items)) {
    count += amount;
  }

  return count;
};

export const getOrderTotal = ({ products, shipping }: { products: OrderItems; shipping: Order["shipping"] }): number =>
  getOrderSubtotal(products) + shipping.cost;
