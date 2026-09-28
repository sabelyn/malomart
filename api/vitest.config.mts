import { defineTestConfig } from "@mm/config/vitest";

export default defineTestConfig(import.meta.url, { setupFiles: ["test/setup.ts"] });
