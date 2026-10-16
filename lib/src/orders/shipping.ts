import type { ShippingMethod } from "./types";

export type SecondsRange = readonly [min: number, max: number];

export type ShippingOption = {
  name: string;
  description: string;
  cost: number;
  fulfillment: {
    shipSeconds: SecondsRange;
    deliverSeconds: SecondsRange;
  };
};

export const ShippingOptions: Record<ShippingMethod, ShippingOption> = {
  Standard: {
    name: "Postman on Foot",
    description: "5 to 7 days",
    cost: 0,
    fulfillment: { shipSeconds: [120, 240], deliverSeconds: [480, 720] }
  },
  Express: {
    name: "Epona Express",
    description: "2 to 3 days",
    cost: 40,
    fulfillment: { shipSeconds: [60, 120], deliverSeconds: [240, 360] }
  },
  Overnight: {
    name: "Loftwing Overnight",
    description: "Next day",
    cost: 150,
    fulfillment: { shipSeconds: [30, 60], deliverSeconds: [120, 180] }
  }
};

export const PAYMENT_SECONDS: SecondsRange = [10, 30];
