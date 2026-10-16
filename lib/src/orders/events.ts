import type { infer as zinfer } from "zod";
import { iso, strictObject } from "zod";

import { Id } from "../common/types";
import { OrderStatusSchema } from "./types";

export const ORDER_EVENT_SOURCE = "malomart.orders";

export const OrderEventType = {
  StatusChanged: "OrderStatusChanged"
} as const;

export const OrderStatusChangedDetail = strictObject({
  orderId: Id,
  customerId: Id,
  previousStatus: OrderStatusSchema.nullable(),
  status: OrderStatusSchema,
  at: iso.datetime()
});
export type OrderStatusChangedDetail = zinfer<typeof OrderStatusChangedDetail>;
