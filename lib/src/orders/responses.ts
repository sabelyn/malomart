import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

import { PaginationData, PositiveInt } from "../common";
import { PaymentMethod } from "../customers/types";
import { Order } from "./types";

export const OrderDto = strictObject({
  ...Order.pick({
    id: true,
    customerId: true,
    products: true,
    currentStatus: true,
    statusUpdates: true,
    orderDate: true,
    address: true,
    shipping: true
  }).shape,
  paymentMethod: PaymentMethod.pick({ brand: true, lastFour: true }).optional()
});
export type OrderDto = zinfer<typeof OrderDto>;

export const OrderOverview = strictObject({
  ...Order.pick({
    id: true,
    customerId: true,
    orderDate: true,
    currentStatus: true
  }).shape,
  total: PositiveInt,
  itemCount: PositiveInt
});
export type OrderOverview = zinfer<typeof OrderOverview>;

export const ListOrdersResponse = strictObject({
  data: OrderOverview.array(),
  pagination: PaginationData
});
export type ListOrdersResponse = zinfer<typeof ListOrdersResponse>;
