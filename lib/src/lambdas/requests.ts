import { strictObject, string } from "zod";
import type { infer as zinfer } from "zod";

import { PaymentMethod } from "../customers/types";

export const CreatePaymentMethodBody = strictObject({
  ...PaymentMethod.pick({
    brand: true,
    expirationMonth: true,
    expirationYear: true
  }).shape,
  cardNumber: string().regex(/^\d{16}$/),
});
export type CreatePaymentMethodBody = zinfer<typeof CreatePaymentMethodBody>;

