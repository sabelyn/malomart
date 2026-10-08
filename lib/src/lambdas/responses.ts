import type { infer as zinfer } from "zod";
import { strictObject, string } from "zod";

import { PaymentMethod } from "../customers/types";

export const CreatePaymentMethodResponse = strictObject({
  token: string().nonempty()
});
export type CreatePaymentMethodResponse = zinfer<typeof CreatePaymentMethodResponse>;

export const PaymentMethodMetadata = PaymentMethod.pick({
  brand: true,
  expirationMonth: true,
  expirationYear: true,
  lastFour: true
});
export type PaymentMethodMetadata = zinfer<typeof PaymentMethodMetadata>;

export const InvokeErrorResponse = strictObject({
  errorName: string()
});
export type InvokeErrorResponse = zinfer<typeof InvokeErrorResponse>;
