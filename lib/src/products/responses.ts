import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

import { PaginationData } from "../common/responses";
import { Product } from "./types";

export const ProductOverview = Product.pick({
  id: true,
  title: true,
  price: true
});
export type ProductOverview = zinfer<typeof ProductOverview>;

export const ListProductsResponse = strictObject({
  data: ProductOverview.array(),
  pagination: PaginationData
});
export type ListProductsResponse = zinfer<typeof ListProductsResponse>;

export const ProductDto = strictObject(Product.shape);
export type ProductDto = zinfer<typeof ProductDto>;
