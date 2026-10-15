import type { ProductOverview } from "@mm/lib/products";
import { getProductsByIds } from "@mm/lib/products";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { endpointQuery } from "@/api";
import { isEmptyCart, stockAdjustments } from "./cartItems";
import { useCart } from "./CartProvider";

const byTitle = (a: ProductOverview, b: ProductOverview) => a.title.localeCompare(b.title);

const adjustmentNotices = (adjustments: Record<string, number>, products: Map<string, ProductOverview>) => {
  const notices: string[] = [];
  let missing = 0;
  for (const [id, amount] of Object.entries(adjustments)) {
    const product = products.get(id);
    if (!product) {
      missing++;
    } else if (amount === 0) {
      notices.push(`${product.title} sold out, so I took it out.`);
    } else {
      notices.push(`${product.title}: only ${amount} left, so that's what you get.`);
    }
  }
  if (missing === 1) {
    notices.push("Something in your cart isn't sold anymore, so I took it out.");
  } else if (missing > 1) {
    notices.push(`${missing} things in your cart aren't sold anymore, so I took them out.`);
  }
  return notices;
};

export const useCartProducts = () => {
  const cart = useCart();
  const { items, ready, adjustments, adjust } = cart;

  const ids = [...new Set([...Object.keys(items), ...Object.keys(adjustments)])].sort();
  const query = useQuery({
    ...endpointQuery(getProductsByIds, { query: { ids } }),
    enabled: ready && ids.length > 0,
    placeholderData: keepPreviousData
  });
  const { data: products, isPlaceholderData } = query;

  useEffect(() => {
    if (!ready || !products || isPlaceholderData) {
      return;
    }
    const changes = stockAdjustments(items, products);
    if (!isEmptyCart(changes)) {
      adjust(changes);
    }
  }, [ready, products, isPlaceholderData, items, adjust]);

  const productsById = new Map((products ?? []).map(product => [product.id, product]));
  const lines = (products ?? []).filter(product => items[product.id] !== undefined).sort(byTitle);
  const subtotal = lines.reduce((total, product) => total + product.price * items[product.id], 0);

  return {
    cart,
    products,
    lines,
    subtotal,
    notices: adjustmentNotices(adjustments, productsById),
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch
  };
};
