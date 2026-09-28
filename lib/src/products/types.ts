import { enum as zenum, strictObject, string, number, uuid } from "zod";
import type { infer as zinfer } from "zod";

import { Id } from "../common";

export const Category = {
  Armor: "Armor",
  Arrows: "Arrows",
  Bombs: "Bombs",
  Food: "Food",
  Masks: "Masks",
  Potions: "Potions",
  Shields: "Shields",
  Weapons: "Weapons"
} as const;
export const CategorySchema = zenum(Category)
  .meta({ id: "ProductCategory" });
export type Category = (typeof Category)[keyof typeof Category];

export const Product = strictObject({
  id: Id,
  title: string().min(3).max(64).meta({ description: "The name of the product.", example: "Mask of Truth" }),
  description: string().min(3).max(500).meta({ example: "Allows you to see into the minds of others." }),
  category: CategorySchema.meta({ example: Category.Masks }),
  price: number().int().positive().meta({ example: 80 }),
  inStock: number().int().nonnegative().meta({ example: 2 })
});
export type Product = zinfer<typeof Product>;
