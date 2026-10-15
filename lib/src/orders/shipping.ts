import type { ShippingMethod } from "./types";

export type ShippingOption = {
  name: string;
  description: string;
  cost: number;
};

export const ShippingOptions: Record<ShippingMethod, ShippingOption> = {
  Standard: { name: "Postman on Foot", description: "5 to 7 days", cost: 0 },
  Express: { name: "Epona Express", description: "2 to 3 days", cost: 40 },
  Overnight: { name: "Loftwing Overnight", description: "Next day", cost: 150 }
};
