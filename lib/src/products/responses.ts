import type { infer as zinfer } from "zod";
import { strictObject, url } from "zod";

import { PaginationData } from "../common/responses";
import { Product } from "./types";

export const ProductOverview = strictObject({
  ...Product.pick({
    id: true,
    title: true,
    price: true,
    originalPrice: true
  }).shape,
  iconUrl: url().optional()
}).meta({ id: "ProductOverview", description: "The information about a product needed to display in a list of products." });
export type ProductOverview = zinfer<typeof ProductOverview>;

export const ListProductsResponse = strictObject({
  data: ProductOverview.array(),
  pagination: PaginationData
});
export type ListProductsResponse = zinfer<typeof ListProductsResponse>;

export const ProductDto = strictObject({
  ...Product.omit({ iconKey: true, imageKeys: true }).shape,
  iconUrl: url().optional(),
  images: url().array().optional()
}).meta({ id: "ProductDto", description: "Full product information for a product page." });
export type ProductDto = zinfer<typeof ProductDto>;
