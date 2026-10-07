import { boolean, strictObject, string, infer as zinfer } from "zod";

import { atLeastOneKeyRefinement } from "../common";
import { Address, PaymentMethod } from "./types";

export const CreateAddressBody = strictObject({
  ...Address.omit({ id: true, customerId: true }).shape,
  setAsDefault: boolean().optional()
});
export type CreateAddressBody = zinfer<typeof CreateAddressBody>;

export const CreatePaymentMethodBody = strictObject({
  ...PaymentMethod.omit({
    id: true
  }).shape,
  setAsDefault: boolean().optional()
});
export type CreatePaymentMethodBody = zinfer<typeof CreatePaymentMethodBody>;

export const UpdateAddressBody = CreateAddressBody.partial().refine(atLeastOneKeyRefinement);
export type UpdateAddressBody = zinfer<typeof UpdateAddressBody>;

export const UpdatePaymentMethodBody = CreatePaymentMethodBody.pick({
  expirationMonth: true,
  expirationYear: true,
  setAsDefault: true
}).refine(atLeastOneKeyRefinement);
export type UpdatePaymentMethodBody = zinfer<typeof UpdatePaymentMethodBody>;
