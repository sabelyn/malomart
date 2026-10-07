import type { infer as zinfer } from "zod";
import { iso, partialRecord, record, strictObject, enum as zenum } from "zod";

import { Id, PositiveInt } from "../common/types";
import { Address, PaymentMethod } from "../customers/types";

export const OrderStatus = {
  Placed: "Placed",
  Confirmed: "Confirmed",
  Shipped: "Shipped",
  Delivered: "Delivered",
  Cancelled: "Cancelled"
} as const;
export const OrderStatusSchema = zenum(OrderStatus);
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export const OrderItemEntry = strictObject({
  amount: PositiveInt,
  pricePerUnit: PositiveInt
});
export type OrderItemEntry = zinfer<typeof OrderItemEntry>;

export const Order = strictObject({
  id: Id,
  customerId: Id,
  address: Address.omit({ id: true, customerId: true }),
  paymentMethod: PaymentMethod.omit({ id: true, customerId: true }),
  orderDate: iso.datetime(),
  status: partialRecord(OrderStatusSchema, iso.datetime()),
  items: record(Id, OrderItemEntry)
});
export type Order = zinfer<typeof Order>;
