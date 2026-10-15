import type { OrderDto } from "@mm/lib/orders";
import { getOrderItemCount } from "@mm/lib/orders";
import { getProductsByIds } from "@mm/lib/products";
import { useQuery } from "@tanstack/react-query";

import { endpointQuery } from "@/api";
import type { CheckoutItem } from "@/components/checkout/CheckoutItems";

export const useOrderItems = (order: OrderDto | undefined) => {
  const entries = Object.entries(order?.products ?? {});
  const ids = entries.map(([id]) => id).sort();
  const products = useQuery({
    ...endpointQuery(getProductsByIds, { query: { ids } }),
    enabled: ids.length > 0
  });

  const byId = new Map((products.data ?? []).map(product => [product.id, product]));
  const items: CheckoutItem[] = entries
    .map(([id, { amount, pricePerUnit }]) => ({
      id,
      title: byId.get(id)?.title ?? "Item no longer sold",
      thumbnailKey: byId.get(id)?.thumbnailKey,
      amount,
      pricePerUnit
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return {
    items,
    count: getOrderItemCount(order?.products ?? {}),
    isPending: products.isPending && ids.length > 0
  };
};
