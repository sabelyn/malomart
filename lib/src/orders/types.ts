import type { infer as zinfer } from "zod";
import { iso, literal, partialRecord, record, strictObject, string, enum as zenum } from "zod";

import { Id, NonnegativeInt, PositiveInt } from "../common/types";
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

export const CancellationReason = {
  Requested: "Requested",
  PaymentDeclined: "PaymentDeclined"
} as const;
export const CancellationReasonSchema = zenum(CancellationReason);
export type CancellationReason = (typeof CancellationReason)[keyof typeof CancellationReason];

export const ShippingMethod = {
  Standard: "Standard",
  Express: "Express",
  Overnight: "Overnight"
} as const;
export const ShippingMethodSchema = zenum(ShippingMethod);
export type ShippingMethod = (typeof ShippingMethod)[keyof typeof ShippingMethod];

export const OrderShipping = strictObject({
  method: ShippingMethodSchema,
  cost: NonnegativeInt
});
export type OrderShipping = zinfer<typeof OrderShipping>;

export const OrderItemEntry = strictObject({
  title: string().nonempty().meta({ description: "The product's title when the order was placed." }),
  amount: PositiveInt,
  pricePerUnit: PositiveInt
});
export type OrderItemEntry = zinfer<typeof OrderItemEntry>;

export const ORDER_ENTITY_TYPE = "Order";

export const Order = strictObject({
  id: Id,
  entityType: literal(ORDER_ENTITY_TYPE).meta({
    description: "Constant partition key for listing all orders by date."
  }),
  customerId: Id,
  address: Address.omit({ id: true, customerId: true, label: true }),
  paymentMethod: PaymentMethod.omit({ id: true, customerId: true }),
  orderDate: iso.datetime(),
  currentStatus: OrderStatusSchema,
  statusUpdates: partialRecord(OrderStatusSchema, iso.datetime()),
  products: record(Id, OrderItemEntry),
  shipping: OrderShipping,
  cancellationReason: CancellationReasonSchema.optional(),
  fulfillmentToken: Id.optional(),
  restockedAt: iso.datetime().optional()
});
export type Order = zinfer<typeof Order>;
