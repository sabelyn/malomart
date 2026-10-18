import type { infer as zinfer } from "zod";
import { record, strictObject, string, url } from "zod";

import { PaginationData } from "../common/responses";
import { ImageUpload, Product } from "./types";

export const ProductOverview = Product.pick({
  id: true,
  title: true,
  category: true,
  price: true,
  originalPrice: true,
  thumbnailKey: true,
  stockCount: true
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

export const GetProductsByIdsResponse = ProductOverview.array().meta({
  id: "GetProductsByIdsResponse",
  description: "The products that were found. IDs that don't match a product are left out."
});
export type GetProductsByIdsResponse = zinfer<typeof GetProductsByIdsResponse>;

export const ProductDto = strictObject({
  ...Product.omit({ imageKeys: true, inStock: true }).shape,
  imageKeys: string().nonempty().array().optional()
}).meta({ id: "ProductDto", description: "Full product information for a product page." });
export type ProductDto = zinfer<typeof ProductDto>;

export const PresignedPostResponse = strictObject({
  url: url(),
  fields: record(string(), string())
});
export type PresignedPostResponse = zinfer<typeof PresignedPostResponse>;

export const ImageUploadPostResponse = strictObject({
  ...PresignedPostResponse.shape,
  uploadId: ImageUpload.shape.id.meta({ description: "Used to check on the upload after posting it to S3." })
}).meta({ id: "ImageUploadPostResponse" });
export type ImageUploadPostResponse = zinfer<typeof ImageUploadPostResponse>;

export const ImageUploadDto = ImageUpload.pick({ id: true, status: true, imageKey: true }).meta({
  id: "ImageUploadDto",
  description: "The processing status of an uploaded image. The image key is set once the image is ready."
});
export type ImageUploadDto = zinfer<typeof ImageUploadDto>;
