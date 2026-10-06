import { infer as zinfer } from "zod";
import { boolean, strictObject, string } from "zod";

import { atLeastOneKeyRefinement } from "../common";
import { Customer, Address, PaymentMethod } from "./types";

export const CreateAddressBody = strictObject({
  ...Address.omit({ id: true }),
  setAsDefault: boolean().optional()
});
export type CreateAddressBody = zinfer<typeof CreateAddressBody>;

export const CreatePaymentMethodBody = strictObject({
  ...PaymentMethod.pick({
    expirationMonth: true,
    expirationYear: true
  }).shape,
  cardNumber: string().regex(/^\d{16}$/),
  setAsDefault: boolean().optional()
});
export type CreatePaymentMethodBody = zinfer<typeof CreatePaymentMethodBody>;

export const UpdateAddressBody = CreateAddressBody.partial().refine(atLeastOneKeyRefinement);
export type UpdateAddressBody = zinfer<typeof UpdateAddressBody>;

export const UpdatePaymentMethodBody = CreatePaymentMethodBody.partial().refine(atLeastOneKeyRefinement);
export type UpdatePaymentMethodBody = zinfer<typeof UpdatePaymentMethodBody>;
