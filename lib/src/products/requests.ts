import { strictObject, number, uuid } from "zod";
import type { infer as zinfer } from "zod";

import { CategorySchema, Product } from "./types";

export const CreateProductBody = Product.pick({
  title: true,
  description: true,
  category: true,
  price: true,
  inStock: true
});
export type CreateProductBody = zinfer<typeof CreateProductBody>;

export const UpdateProductBody = Product.pick({
  title: true,
  description: true,
  price: true
}).partial();
export type UpdateProductBody = zinfer<typeof UpdateProductBody>;

export const StockUpdate = strictObject({
  productId: uuid(),
  stockAmount: number().int()
});
export type StockUpdate = zinfer<typeof StockUpdate>;

export const UpdateStockBody = StockUpdate.array().nonempty();
export type UpdateStockBody = zinfer<typeof UpdateStockBody>;
