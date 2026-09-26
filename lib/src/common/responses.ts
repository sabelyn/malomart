import { strictObject } from "zod";
import type { infer as zinfer } from "zod";

import { PositiveInt, NonnegativeInt } from "./types";

export const PaginationData = strictObject({
  page: PositiveInt,
  limit: PositiveInt,
  total: NonnegativeInt,
  totalPages: PositiveInt
});
export type PaginationData = zinfer<typeof PaginationData>;
