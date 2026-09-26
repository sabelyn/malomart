import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

import { Product } from "./types";
import { PaginationData } from "@/common/responses";

export const ProductOverview = Product.pick({
  id: true,
  title: true,
  price: true
});
export type ProductOverview = zinfer<typeof ProductOverview>;

export const ListProductsResponse = strictObject({
  products: ProductOverview.array(),
  pagination: PaginationData
});
export type ListProductsResponse = zinfer<typeof ListProductsResponse>;

export const ProductDto = strictObject(Product.shape);
export type ProductDto = zinfer<typeof ProductDto>;
