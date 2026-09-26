import { number } from "zod";

export const NonnegativeInt = number().int().nonnegative();
export const PositiveInt = number().int().positive();
