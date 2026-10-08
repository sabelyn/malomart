import { boolean, literal, strictObject, string, infer as zinfer } from "zod";

import { atLeastOneKeyRefinement } from "../common";
import { Address, PaymentMethod } from "./types";

export const CreateAddressBody = strictObject({
  ...Address.omit({ id: true, customerId: true }).shape,
  setAsDefault: boolean().optional()
});
export type CreateAddressBody = zinfer<typeof CreateAddressBody>;

export const CreatePaymentMethodWithTokenBody = strictObject({
  token: string().nonempty(),
  setAsDefault: boolean().optional()
});
export type CreatePaymentMethodWithTokenBody = zinfer<typeof CreatePaymentMethodWithTokenBody>;

export const UpdateAddressBody = CreateAddressBody.partial().refine(atLeastOneKeyRefinement);
export type UpdateAddressBody = zinfer<typeof UpdateAddressBody>;

export const UpdatePaymentMethodBody = strictObject({
  expiration: PaymentMethod.pick({ expirationMonth: true, expirationYear: true }).optional(),
  setAsDefault: literal(true).optional()
}).refine(atLeastOneKeyRefinement);
export type UpdatePaymentMethodBody = zinfer<typeof UpdatePaymentMethodBody>;
