// @ts-check
import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import eslintConfigPrettier from "eslint-config-prettier";
import importX from "eslint-plugin-import-x";
import tseslint from "typescript-eslint";

// @type {import("eslint").Linter.Config[]}
export const config = tseslint.config([
  globalIgnores(["node_modules/**", "coverage/**", "dist/**", "cdk.out/**", ".turbo/**", "eslint.config.mjs"]),
  {
    plugins: {
      "import-x": importX,
      "@typescript-eslint": tseslint.plugin
    },
    languageOptions: {
      parserOptions: {
        projectService: true
      }
    }
  },
  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  eslintConfigPrettier,
  {
    rules: {
      curly: ["error", "all"],
      eqeqeq: "error",
      "func-style": "error",
      "import-x/consistent-type-specifier-style": ["error", "prefer-top-level"],
      "import-x/newline-after-import": ["error"],
      "import-x/no-duplicates": ["error"],
      "import-x/order": [
        "error",
        {
          "newlines-between": "always",
          // Two blocks only — third-party, then everything of ours. Within our block the
          // pathGroups order it @/ → ../ → ./, matching TypeScript's organize-imports, and
          // `distinctGroup: false` keeps that from splitting the block up with blank lines.
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"]
          ],
          distinctGroup: false,
          pathGroups: [
            { pattern: "@/**", group: "internal", position: "before" },
            { pattern: "../**", group: "internal", position: "before" }
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true
          }
        }
      ],
      "no-useless-escape": "error",
      "no-useless-return": "error",
      "no-var": "error",
      "prefer-arrow-callback": "error",
      "prefer-const": "error",
      "prefer-object-spread": "error",
      "prefer-regex-literals": "error",
      "prefer-template": "error",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-misused-promises": [
        "error",
        {
          checksVoidReturn: {
            arguments: false,
            attributes: false
          }
        }
      ],
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_"
        }
      ]
    }
  }
]);

export default config;
