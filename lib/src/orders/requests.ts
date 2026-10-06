import type { infer as zinfer } from "zod";
import { object, strictObject } from "zod";

import { Id, PaginationQuery } from "../common";
import { Order, OrderStatusSchema } from "./types";

export const CreateOrderBody = strictObject({
  ...Order.pick({
    customerId: true,
    items: true
  }).shape,
  addressId: Id,
  paymentMethodId: Id
});
export type CreateOrderBody = zinfer<typeof CreateOrderBody>;

export const UpdateOrderStatusBody = strictObject({
  status: OrderStatusSchema
});
export type UpdateOrderStatusBody = zinfer<typeof UpdateOrderStatusBody>;

export const ListOrdersQuery = object({
  ...PaginationQuery.shape,
  customerId: Id.optional(),
  statuses: OrderStatusSchema.array().optional()
});
export type ListOrdersQuery = zinfer<typeof ListOrdersQuery>;
