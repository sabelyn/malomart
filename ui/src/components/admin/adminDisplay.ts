import { formatRupees } from "@/components/PriceTag";

export const adminProductPath = (id: string) => `/admin/products/${id}`;

export const stockLabel = (stockCount: number) => (stockCount === 0 ? "Out of stock" : `${stockCount} in stock`);

export const priceLabel = (price: number, originalPrice?: number | null) =>
  originalPrice
    ? `${formatRupees(price)} rupees, down from ${formatRupees(originalPrice)}`
    : `${formatRupees(price)} rupees`;
