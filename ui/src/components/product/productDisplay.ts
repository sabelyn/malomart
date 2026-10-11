import { IMAGE_WIDTHS, imageVariantKey } from "@mm/lib/products";

export const stockLine = (inStock: number) => {
  if (inStock === 0) {
    return "Sold out. Should've been faster.";
  }
  if (inStock <= 3) {
    return `${inStock} left. Decide.`;
  }
  return `${inStock} in stock.`;
};

export const percentOff = (price: number, originalPrice?: number | null) =>
  originalPrice ? Math.floor(((originalPrice - price) * 100) / originalPrice) : 0;

export const productImageSrc = (imageKey: string, width: number) => `/${imageVariantKey(imageKey, width)}`;

export const productImageSrcSet = (imageKey: string) =>
  IMAGE_WIDTHS.map(width => `${productImageSrc(imageKey, width)} ${width}w`).join(", ");
