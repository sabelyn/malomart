import type { infer as zinfer } from "zod";
import { number, record, strictObject, string, enum as zenum } from "zod";

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
export const Region = zenum(Regions, { error: "Choose a region." });
export type Region = (typeof Regions)[number];

export const CardBrands = ["Hyrulian Express", "Castle One"] as const;
export const CardBrand = zenum(CardBrands, { error: "Choose a card brand." });
export type CardBrand = (typeof CardBrands)[number];

export const Customer = strictObject({
  id: Id,
  defaultAddressId: Id.nullish(),
  defaultPaymentMethodId: Id.nullish()
});
export type Customer = zinfer<typeof Customer>;

export const Address = strictObject({
  id: Id,
  customerId: Id,
  label: string()
    .trim()
    .nonempty({ error: "Enter a label or leave it blank." })
    .max(40, { error: "Labels can't be longer than 40 characters." })
    .optional(),
  recipient: string()
    .trim()
    .nonempty({ error: "Enter who receives deliveries here." })
    .max(100, { error: "Names can't be longer than 100 characters." }),
  street: string().trim().nonempty({ error: "Enter a street address." }),
  city: string().trim().nonempty({ error: "Enter a city." }),
  region: Region,
  postalCode: string().regex(/^\d{5}$/, { error: "Enter a 5-digit postal code." })
});
export type Address = zinfer<typeof Address>;

export const PaymentMethod = strictObject({
  id: Id,
  customerId: Id,
  brand: CardBrand,
  expirationMonth: number().int().min(0).max(11),
  expirationYear: PositiveInt,
  lastFour: string().regex(/^\d{4}$/),
  token: string().nonempty()
});
export type PaymentMethod = zinfer<typeof PaymentMethod>;

export const Cart = strictObject({
  customerId: Id,
  items: record(Id, PositiveInt)
});
export type Cart = zinfer<typeof Cart>;
