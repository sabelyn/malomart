import type { infer as zinfer } from "zod";
import { boolean, strictObject } from "zod";

import { Id } from "../common/types";
import { Address, PaymentMethod } from "./types";

export const AddressDto = strictObject({
  ...Address.shape,
  isDefault: boolean()
});
export type AddressDto = zinfer<typeof AddressDto>;

export const PaymentMethodDto = strictObject({
  ...PaymentMethod.omit({ token: true }).shape,
  isDefault: boolean()
});
export type PaymentMethodDto = zinfer<typeof PaymentMethodDto>;

export const ListAddressesResponse = AddressDto.array();
export type ListAddressesResponse = zinfer<typeof ListAddressesResponse>;

export const ListPaymentMethodsResponse = PaymentMethodDto.array();
export type ListPaymentMethodsResponse = zinfer<typeof ListPaymentMethodsResponse>;

export const CustomerDto = strictObject({
  id: Id,
  defaultAddress: Address.nullable(),
  defaultPaymentMethod: PaymentMethod.nullable()
});
export type CustomerDto = zinfer<typeof CustomerDto>;
