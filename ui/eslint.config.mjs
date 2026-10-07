// @ts-check
import base from "@mm/config/eslint";
import { globalIgnores } from "eslint/config";
import react from "eslint-plugin-react-hooks";
import { config } from "typescript-eslint";

// @type {import("eslint").Linter.Config[]}
export default config([
  base,
  globalIgnores(["postcss.config.cjs"]),
  {
    plugins: {
      react: react
    }
  }
]);
