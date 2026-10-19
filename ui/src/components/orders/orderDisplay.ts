import type { OrderDto } from "@mm/lib/orders";
import { OrderStatus, ShippingOptions } from "@mm/lib/orders";

import { ui } from "@/copy";

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" });

export const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();

export const formatOrderDate = (iso: string) => dateFormat.format(new Date(iso));

export const formatOrderDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));

export const shippingSummary = ({ method, cost }: OrderDto["shipping"]) => {
  const { name, description } = ShippingOptions[method];
  return ui.orders.shippingSummary(name, description, cost);
};

export const isCancellable = (status: OrderStatus) => status === OrderStatus.Placed || status === OrderStatus.Confirmed;
