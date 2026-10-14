import type { infer as zinfer } from "zod";
import { boolean, record, strictObject } from "zod";

import { Id, NonnegativeInt, PositiveInt } from "../common/types";
import { Address, PaymentMethod } from "./types";

export const AddressDto = strictObject({
  ...Address.omit({ customerId: true }).shape,
  isDefault: boolean()
});
export type AddressDto = zinfer<typeof AddressDto>;

export const PaymentMethodDto = strictObject({
  ...PaymentMethod.omit({ customerId: true, token: true }).shape,
  isDefault: boolean()
});
export type PaymentMethodDto = zinfer<typeof PaymentMethodDto>;

export const ListAddressesResponse = AddressDto.array();
export type ListAddressesResponse = zinfer<typeof ListAddressesResponse>;

export const ListPaymentMethodsResponse = PaymentMethodDto.array();
export type ListPaymentMethodsResponse = zinfer<typeof ListPaymentMethodsResponse>;

export const CustomerDto = strictObject({
  id: Id,
  defaultAddress: AddressDto.nullable(),
  defaultPaymentMethod: PaymentMethodDto.nullable(),
  cart: record(Id, PositiveInt)
});
export type CustomerDto = zinfer<typeof CustomerDto>;

export const UpdateCartResponse = record(Id, NonnegativeInt).meta({
  id: "UpdateCartResponse",
  description: "Quantities that were reduced to match available stock. Items reduced to 0, including products that no longer exist, were removed from the cart."
});
export type UpdateCartResponse = zinfer<typeof UpdateCartResponse>;
