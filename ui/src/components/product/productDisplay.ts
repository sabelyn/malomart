import { IMAGE_WIDTHS, imageVariantKey } from "@mm/lib/products";

export const percentOff = (price: number, originalPrice?: number | null) =>
  originalPrice ? 100 - Math.floor((price / originalPrice) * 100) : 0;

export const productImageSrc = (imageKey: string, width: number) => `/${imageVariantKey(imageKey, width)}`;

export const productImageSrcSet = (imageKey: string) =>
  IMAGE_WIDTHS.map(width => `${productImageSrc(imageKey, width)} ${width}w`).join(", ");
