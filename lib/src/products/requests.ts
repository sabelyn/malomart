import type { input, infer as zinfer } from "zod";
import { number, object, strictObject, string } from "zod";

import { atLeastOneKeyRefinement, Id, PaginationQuery, QueryBool } from "../common";
import { CategorySchema, Product } from "./types";

export const CreateProductBody = Product.pick({
  title: true,
  description: true,
  category: true,
  price: true,
  inStock: true,
  originalPrice: true,
  features: true
}).meta({ id: "CreateProductData" });
export type CreateProductBody = zinfer<typeof CreateProductBody>;

export const ListProductsQuery = object({
  ...PaginationQuery.shape,
  category: CategorySchema.optional(),
  inStock: QueryBool.optional()
}).meta({ id: "ListProductsQuery" });
export type ListProductsQuery = zinfer<typeof ListProductsQuery>;
export type ListProductsQueryInput = input<typeof ListProductsQuery>;

export const UpdateProductBody = Product.pick({
  title: true,
  description: true,
  price: true,
  features: true
})
  .partial()
  .refine(atLeastOneKeyRefinement)
  .meta({ id: "UpdateProductBody", description: "At least one property must be provided." });
export type UpdateProductBody = zinfer<typeof UpdateProductBody>;

export const StockUpdate = strictObject({
  productId: Id,
  stockAmount: number().int()
});
export type StockUpdate = zinfer<typeof StockUpdate>;

export const UpdateStockBody = StockUpdate.array().nonempty();
export type UpdateStockBody = zinfer<typeof UpdateStockBody>;

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
