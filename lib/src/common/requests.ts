import type { infer as zinfer } from "zod";
import { boolean, coerce, strictObject, string, stringbool, union, uuid } from "zod";

import { Id } from "./types";

export const IdParams = strictObject({
  id: Id
});
export type IdParams = zinfer<typeof IdParams>;

export const PaginationQuery = strictObject({
  cursor: string().optional().meta({ description: "The base64 pagination cursor returned by the server in a previous request." }),
  limit: coerce.number().int().min(10).max(100).optional().default(20).meta({ description: "The maximum number of items to return per page." })
});
export type PaginationQuery = zinfer<typeof PaginationQuery>;

export const QueryBool = union([stringbool(), boolean()]);
