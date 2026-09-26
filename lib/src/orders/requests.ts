import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

import { Order, OrderStatusSchema } from "./types";

export const CreateOrderBody = Order.pick({
  customerId: true,
  addressId: true,
  paymentMethodId: true,
  items: true
});
export type CreateOrderBody = zinfer<typeof CreateOrderBody>;

export const UpdateOrderStatusBody = strictObject({
  status: OrderStatusSchema
});
export type UpdateOrderStatusBody = zinfer<typeof UpdateOrderStatusBody>;
