import type { infer as zinfer } from "zod";
import { strictObject, string } from "zod";

import { PaymentMethod } from "../customers/types";

export const CreatePaymentMethodBody = strictObject({
  ...PaymentMethod.pick({
    brand: true,
    expirationMonth: true,
    expirationYear: true
  }).shape,
  cardNumber: string().regex(/^\d{16}$/)
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
