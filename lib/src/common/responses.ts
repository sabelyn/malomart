import type { infer as zinfer } from "zod";
import { boolean, strictObject, string } from "zod";

import { PositiveInt } from "./types";

export const PaginationData = strictObject({
  cursor: string().optional(),
  hasNext: boolean(),
  limit: PositiveInt
});
export type PaginationData = zinfer<typeof PaginationData>;
