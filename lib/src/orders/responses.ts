import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

import { PositiveInt, PaginationData } from "../common";
import { Address } from "../customers/types";
import { Order, OrderStatusSchema } from "./types";

export const OrderDto = strictObject({
  ...Order.pick({
    id: true,
    customerId: true,
    items: true,
    status: true,
    orderDate: true
  }).shape,
  shippingAddress: Address
});
export type OrderDto = zinfer<typeof OrderDto>;

export const OrderOverview = strictObject({
  ...Order.pick({
    id: true,
    customerId: true,
    orderDate: true
  }).shape,
  currentStatus: OrderStatusSchema,
  total: PositiveInt
});
export type OrderOverview = zinfer<typeof OrderOverview>;

export const ListOrdersResponse = strictObject({
  data: OrderOverview.array(),
  pagination: PaginationData
});
export type ListOrdersResponse = zinfer<typeof ListOrdersResponse>;
