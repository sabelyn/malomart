import type { Order } from "./types";

type OrderItems = Order["products"];

// Prices on this website are whole numbers, so no need to account for floating point addition
export const getOrderSubtotal = (items: OrderItems): number => {
  let total = 0;
  for (const { amount, pricePerUnit } of Object.values(items)) {
    total += amount * pricePerUnit;
  }

  return total;
};

export const getOrderTotal = ({ products, shipping }: Pick<Order, "products" | "shipping">): number =>
  getOrderSubtotal(products) + shipping.cost;
