import type { infer as zinfer } from "zod";
import { boolean, strictObject, string } from "zod";

import { PositiveInt } from "./types";

export const PaginationData = strictObject({
  cursor: string()
    .optional()
    .meta({ description: "A base64 string representing the last evaluated key on this page." }),
  hasNext: boolean(),
  limit: PositiveInt
}).meta({ id: "PaginationData", description: "Returned alongside list results for paginated query requests." });
export type PaginationData = zinfer<typeof PaginationData>;
