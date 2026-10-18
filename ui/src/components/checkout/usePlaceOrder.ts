import { createOrder, getOrder, orders } from "@mm/lib/orders";
import { products } from "@mm/lib/products";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { endpointQuery, routeKey, useEndpointMutation } from "@/api";
import { serverCartQuery, useCart } from "@/components/cart/CartProvider";
import { orderPlacedPath } from "@/routes/paths";
import { isStaleOrder } from "./checkoutDisplay";

export const usePlaceOrder = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();

  return useEndpointMutation(createOrder, {
    scope: { id: "cart" },
    invalidates: [orders],
    onSuccess: order => {
      queryClient.setQueryData(endpointQuery(getOrder, { params: { id: order.id } }).queryKey, order);
      queryClient.setQueryData(serverCartQuery(order.customerId).queryKey, {});
      void navigate(orderPlacedPath(order.id), { replace: true });
    },
    onError: err => {
      if (isStaleOrder(err)) {
        void queryClient.invalidateQueries({ queryKey: routeKey(products) });
        cart.retryLoad();
      }
    }
  });
};
