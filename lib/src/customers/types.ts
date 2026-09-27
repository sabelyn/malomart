import type { infer as zinfer } from "zod";
import { strictObject, string, uuid, enum as zenum } from "zod";

export const Regions = [] as const;
export const Region = zenum(Regions);
export type Region = (typeof Regions)[number];

export const Customer = strictObject({
  id: uuid(),
  defaultAddressId: uuid().optional(),
  defaultPaymentMethodId: uuid().optional()
});
export type Customer = zinfer<typeof Customer>;

export const Address = strictObject({
  street: string().nonempty(),
  city: string().nonempty(),
  region: Region,
  postalCode: string().regex(/\d{5}/)
});
export type Address = zinfer<typeof Address>;
