import { defineLibConfig } from "@mm/config/vite-lib";

export default defineLibConfig(import.meta.url, ["src/index.ts", "src/dbClient.ts", "src/s3Client.ts"]);
