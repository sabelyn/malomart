import type { infer as zinfer } from "zod";
import { strictObject, string, enum as zenum } from "zod";

import { Id, NonnegativeInt, PositiveInt } from "../common";

export const Category = {
  Armor: "Armor",
  Arrows: "Arrows",
  Bombs: "Bombs",
  Food: "Food",
  Gadgets: "Gadgets",
  Masks: "Masks",
  Misc: "Misc",
  Potions: "Potions",
  Shields: "Shields",
  Weapons: "Weapons"
} as const;
export const CategorySchema = zenum(Category).meta({ id: "ProductCategory" });
export type Category = (typeof Category)[keyof typeof Category];

export const Product = strictObject({
  id: Id,
  title: string().min(3).max(64).meta({ description: "The name of the product.", example: "Mask of Truth" }),
  description: string().min(3).max(500).meta({ example: "Allows you to see into the minds of others." }),
  category: CategorySchema.meta({ example: Category.Masks }),
  price: PositiveInt.meta({ example: 80 }),
  inStock: NonnegativeInt.meta({ example: 2 }),
  originalPrice: PositiveInt.optional(),
  iconKey: string().nonempty().optional(),
  imageKeys: string().nonempty().array().optional(),
  features: string().nonempty().array()
});
export type Product = zinfer<typeof Product>;
