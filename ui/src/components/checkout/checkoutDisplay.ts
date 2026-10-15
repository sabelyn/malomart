import { formatRupees } from "@/components/PriceTag";

export const shippingCostLabel = (cost: number) => (cost === 0 ? "Free" : `${formatRupees(cost)} rupees`);

export const itemsLabel = (count: number) => `${count} ${count === 1 ? "item" : "items"}`;
