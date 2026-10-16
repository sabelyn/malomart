import type { infer as zinfer } from "zod";
import { discriminatedUnion, literal, strictObject, string, enum as zenum } from "zod";

import { Id } from "../common/types";
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

export const DeclineReason = {
  Declined: "Declined",
  Expired: "Expired"
} as const;
export const DeclineReasonSchema = zenum(DeclineReason);
export type DeclineReason = (typeof DeclineReason)[keyof typeof DeclineReason];

export const ChargeCardResult = discriminatedUnion("approved", [
  strictObject({ approved: literal(true), chargeId: Id }),
  strictObject({ approved: literal(false), reason: DeclineReasonSchema })
]);
export type ChargeCardResult = zinfer<typeof ChargeCardResult>;
