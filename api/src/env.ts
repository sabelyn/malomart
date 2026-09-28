import { TableIndexes, TableNames } from "@mm/clients";
import { enum as zenum, preprocess, coerce, object, string, url, prettifyError, ZodError } from "zod";
import type { infer as zinfer, ZodSchema } from "zod";

const fromJson = <T extends ZodSchema>(schema: T) =>
  preprocess(val => {
    if (typeof val === "string") {
      try {
        return JSON.parse(val);
      } catch (err) {
        console.log(err);
      }
    }
    return val;
  }, schema);

const EnvSchema = object({
  ADMIN_SCOPE: string().nonempty(),
  FRONTEND_URL: url().optional().default("http://localhost:3000"),
  NODE_ENV: zenum(["development", "production"]).optional().default("development"),
  PORT: coerce.number().int().positive().optional().default(4000),
  TABLE_INDEXES: fromJson(TableIndexes),
  TABLE_NAMES: fromJson(TableNames),
  USER_POOL_ID: string().nonempty(),
  USER_POOL_CLIENT_ID: string().nonempty()
});
export type Env = zinfer<typeof EnvSchema>;

let env: Env;
try {
  env = EnvSchema.parse(process.env);
} catch (err) {
  if (err instanceof ZodError) {
    throw new Error(`Invalid environment configuration: ${prettifyError(err)}`, { cause: err });
  }
  throw err;
}

export default { ...env };
