import type { output, ZodType } from "zod";
import { ZodError } from "zod";

import { internal } from "@/errors/helpers";

export const parseStored = <T extends ZodType>(data: unknown, schema: T): output<T> => {
  try {
    return schema.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      throw internal(err);
    }
    throw err;
  }
};
