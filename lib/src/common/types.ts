import { guid, number } from "zod";

export const Id = guid().meta({
  id: "ID",
  description: "A UUID-shaped identifier. Cognito user IDs don't always use a standard UUID version or variant."
});
export const NonnegativeInt = number().int().nonnegative();
export const PositiveInt = number().int().positive();
