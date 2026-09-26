import { enum as zenum, partialRecord, iso, record, strictObject, number, uuid } from "zod";
import type { infer as zinfer } from "zod";

import { PositiveInt } from "@/common/types";

export const OrderStatus = {
  Placed: "Placed",
  Confirmed: "Confirmed",
  Shipped: "Shipped",
  Delivered: "Delivered",
  Cancelled: "Cancelled"
} as const;
export const OrderStatusSchema = zenum(OrderStatus);
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const OrderItemEntry = strictObject({
  amount: PositiveInt,
  pricePerUnit: PositiveInt
});
export type OrderItemEntry = zinfer<typeof OrderItemEntry>;

export const Order = strictObject({
  id: uuid(),
  customerId: uuid(),
  addressId: uuid(),
  paymentMethodId: uuid(),
  orderDate: iso.datetime(),
  status: partialRecord(OrderStatusSchema, iso.datetime()),
  items: record(uuid(), OrderItemEntry)
});
export type Order = zinfer<typeof Order>;
