import { useSearchParams } from "react-router";
import type { input, output, ZodObject } from "zod";

const parseSearch = <S extends ZodObject>(schema: S, params: URLSearchParams): output<S> => {
  const raw = Object.fromEntries(params);
  const result = schema.safeParse(raw);
  if (result.success) {
    return result.data;
  }

  const invalidKeys = new Set(result.error.issues.map(issue => String(issue.path[0])));
  const cleaned = Object.fromEntries(Object.entries(raw).filter(([key]) => !invalidKeys.has(key)));
  const retry = schema.safeParse(cleaned);
  return (retry.success ? retry.data : {}) as output<S>;
};

export const useSchemaSearch = <S extends ZodObject>(schema: S) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const values = parseSearch(schema, searchParams);
  const defaults: Record<string, unknown> = schema.safeParse({}).data ?? {};

  const update = (changes: Partial<input<S>>) =>
    setSearchParams(
      previous => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === null || value === "" || String(value) === String(defaults[key])) {
            next.delete(key);
          } else {
            next.set(key, String(value));
          }
        }
        return next;
      },
      { replace: true }
    );

  return [values, update] as const;
};
