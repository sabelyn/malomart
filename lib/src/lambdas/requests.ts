import type { infer as zinfer } from "zod";
import { strictObject, string } from "zod";

import { Id, PositiveInt } from "../common/types";
import { PaymentMethod } from "../customers/types";

export const CreatePaymentMethodBody = strictObject({
  ...PaymentMethod.pick({
    brand: true,
    expirationMonth: true,
    expirationYear: true
  }).shape,
  cardNumber: string().regex(/^\d{16}$/, { error: "Enter the 16-digit card number." })
});
export type CreatePaymentMethodBody = zinfer<typeof CreatePaymentMethodBody>;

export const PaymentMethodIdEvent = PaymentMethod.pick({
  customerId: true,
  token: true
});
export type PaymentMethodIdEvent = zinfer<typeof PaymentMethodIdEvent>;

export const UpdatePaymentMethodExpirationEvent = PaymentMethod.pick({
  expirationMonth: true,
  expirationYear: true,
  token: true,
  customerId: true
});
export type UpdatePaymentMethodExpirationEvent = zinfer<typeof UpdatePaymentMethodExpirationEvent>;

export const ChargeCardEvent = strictObject({
  ...PaymentMethod.pick({
    customerId: true,
    token: true
  }).shape,
  orderId: Id,
  amount: PositiveInt
});
export type ChargeCardEvent = zinfer<typeof ChargeCardEvent>;
