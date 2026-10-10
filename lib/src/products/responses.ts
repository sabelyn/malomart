import type { infer as zinfer } from "zod";
import { record, strictObject, string, url } from "zod";

import { PaginationData } from "../common/responses";
import { Product } from "./types";

export const ProductOverview = Product.pick({
  id: true,
  title: true,
  price: true,
  originalPrice: true,
  thumbnailKey: true,
  inStock: true
}).meta({
  id: "ProductOverview",
  description: "The information about a product needed to display in a list of products."
});
export type ProductOverview = zinfer<typeof ProductOverview>;

export const ListProductsResponse = strictObject({
  data: ProductOverview.array(),
  pagination: PaginationData
});
export type ListProductsResponse = zinfer<typeof ListProductsResponse>;

export const ProductDto = strictObject({
  ...Product.omit({ imageKeys: true }).shape,
  imageKeys: string().nonempty().array().optional()
}).meta({ id: "ProductDto", description: "Full product information for a product page." });
export type ProductDto = zinfer<typeof ProductDto>;

export const PresignedPostResponse = strictObject({
  url: url(),
  fields: record(string(), string())
});
export type PresignedPostResponse = zinfer<typeof PresignedPostResponse>;
