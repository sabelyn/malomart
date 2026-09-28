import { number, uuid } from "zod";

export const Id = uuid().meta({ id: "ID" });
export const NonnegativeInt = number().int().nonnegative();
export const PositiveInt = number().int().positive();
