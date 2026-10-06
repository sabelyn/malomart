import type { infer as zinfer } from "zod";
import { number, strictObject, string, uuid, enum as zenum } from "zod";

import { Id, PositiveInt } from "../common";

export const Regions = [
  "Akkala",
  "Central Hyrule",
  "Eldin",
  "Faron",
  "Gerudo Highlands",
  "Gerudo Valley",
  "Great Bay",
  "Hebra",
  "Ikana",
  "Lanayru",
  "Necluda",
  "Snow Peak",
  "Tabantha"
] as const;
export const Region = zenum(Regions);
export type Region = (typeof Regions)[number];

export const Customer = strictObject({
  id: Id,
  defaultAddressId: Id.optional(),
  defaultPaymentMethodId: Id.optional()
});
export type Customer = zinfer<typeof Customer>;

export const Address = strictObject({
  id: Id,
  street: string().nonempty(),
  city: string().nonempty(),
  region: Region,
  postalCode: string().regex(/^\d{5}$/)
});
export type Address = zinfer<typeof Address>;

export const PaymentMethod = strictObject({
  id: Id,
  expirationMonth: number().int().min(0).max(11),
  expirationYear: PositiveInt,
  lastFour: string().regex(/^\d{4}$/),
  token: string().nonempty(),
});
export type PaymentMethod = zinfer<typeof PaymentMethod>;
