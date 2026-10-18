import type { input, infer as zinfer } from "zod";
import { number, object, preprocess, strictObject, string } from "zod";

import { atLeastOneKeyRefinement, Id, PaginationQuery, QueryBool } from "../common";
import { CategorySchema, Product } from "./types";

export const CreateProductBody = Product.pick({
  title: true,
  description: true,
  category: true,
  price: true,
  stockCount: true,
  originalPrice: true,
  features: true
}).meta({ id: "CreateProductData" });
export type CreateProductBody = zinfer<typeof CreateProductBody>;

export const ListProductsQuery = object({
  ...PaginationQuery.shape,
  category: CategorySchema.optional(),
  inStock: QueryBool.optional().meta({
    description: "True for only products in stock, false for only products out of stock. Omit for both."
  })
}).meta({ id: "ListProductsQuery" });
export type ListProductsQuery = zinfer<typeof ListProductsQuery>;
export type ListProductsQueryInput = input<typeof ListProductsQuery>;

export const MAX_BATCH_PRODUCTS = 100;

export const GetProductsByIdsQuery = strictObject({
  ids: preprocess(
    value => (typeof value === "string" ? value.split(",") : value),
    Id.array().min(1).max(MAX_BATCH_PRODUCTS)
  ).meta({ description: "Comma-separated product IDs." })
}).meta({ id: "GetProductsByIdsQuery" });
export type GetProductsByIdsQuery = zinfer<typeof GetProductsByIdsQuery>;

export const UpdateProductBody = Product.pick({
  title: true,
  category: true,
  description: true,
  originalPrice: true,
  price: true,
  features: true
})
  .partial()
  .refine(atLeastOneKeyRefinement)
  .meta({ id: "UpdateProductBody", description: "At least one property must be provided." });
export type UpdateProductBody = zinfer<typeof UpdateProductBody>;

export const MAX_STOCK_CHANGE = 10_000;

export const AdjustStockBody = strictObject({
  change: number()
    .int()
    .min(-MAX_STOCK_CHANGE)
    .max(MAX_STOCK_CHANGE)
    .refine(value => value !== 0, { error: "The change can't be zero." })
    .meta({ description: "Positive to add stock, negative to remove it.", example: 5 })
}).meta({ id: "AdjustStockBody" });
export type AdjustStockBody = zinfer<typeof AdjustStockBody>;

export const RequestImageUploadPostQuery = strictObject({
  contentType: string().regex(/^image\//i)
});
export type RequestImageUploadPostQuery = zinfer<typeof RequestImageUploadPostQuery>;

export const ProductImageParams = strictObject({
  id: Id.meta({ description: "The product ID." }),
  hash: string()
    .nonempty()
    .meta({ description: "Just the hash portion of the image key to avoid additional slashes in the path." })
});
export type ProductImageParams = zinfer<typeof ProductImageParams>;

export const ImageUploadParams = strictObject({
  id: Id.meta({ description: "The product ID." }),
  uploadId: Id.meta({ description: "The upload ID returned when the upload was requested." })
});
export type ImageUploadParams = zinfer<typeof ImageUploadParams>;
