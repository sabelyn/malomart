import type { AddressDto, PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired } from "@mm/lib/customers";

import { ui } from "@/copy";

type Expiration = Pick<PaymentMethodDto, "expirationMonth" | "expirationYear">;

export const addressName = (address: AddressDto) => address.label ?? address.street;

export const addressLines = (address: AddressDto) => [
  address.recipient,
  address.street,
  `${address.city}, ${address.region} ${address.postalCode}`
];

export const paymentMethodName = (method: PaymentMethodDto) => ui.cards.name(method.brand, method.lastFour);

export const formatExpiration = ({ expirationMonth, expirationYear }: Expiration) =>
  `${String(expirationMonth + 1).padStart(2, "0")}/${expirationYear}`;

export const paymentMethodExpiry = (method: PaymentMethodDto) =>
  ui.cards.expiry(isCardExpired(method), formatExpiration(method));
