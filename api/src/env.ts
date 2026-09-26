import { coerce, object, string, url, prettifyError, ZodError } from "zod";
import type { infer as zinfer } from "zod";

const EnvSchema = object({
  ADMIN_SCOPE: string().nonempty(),
  FRONTEND_URL: url().optional().default("http://localhost:3000"),
  PORT: coerce.number().int().positive().optional().default(4000),
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
