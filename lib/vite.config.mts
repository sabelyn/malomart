import { defineLibConfig } from "@mm/config/vite-lib";

export default defineLibConfig(import.meta.url, [
  "src/index.ts",
  "src/common/index.ts",
  "src/customers/index.ts",
  "src/orders/index.ts",
  "src/products/index.ts"
]);
