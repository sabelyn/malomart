import { enum as zenum, strictObject, string, number, uuid } from "zod";
import type { infer as zinfer } from "zod";

export const Category = {
  Arrows: "Arrows",
  Bombs: "Bombs",
  Food: "Food",
  Masks: "Masks",
  Potions: "Potions",
  Shields: "Shields",
  Weapons: "Weapons"
} as const;
export const CategorySchema = zenum(Category);
export type Category = (typeof Category)[keyof typeof Category];

export const Product = strictObject({
  id: uuid(),
  title: string().min(3).max(64),
  description: string().min(3).max(500),
  category: CategorySchema,
  price: number().int().positive(),
  inStock: number().int().nonnegative()
});
export type Product = zinfer<typeof Product>;
