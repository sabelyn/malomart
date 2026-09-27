import type { infer as zinfer } from "zod";
import { boolean, coerce, strictObject, string, stringbool, union } from "zod";

export const QueryBool = union([stringbool(), boolean()]);

export const PaginationQuery = strictObject({
  cursor: string().optional(),
  limit: coerce.number().int().min(10).max(100).optional().default(20)
});
export type PaginationQuery = zinfer<typeof PaginationQuery>;
