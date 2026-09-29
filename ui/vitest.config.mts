import { defineTestConfig } from "@mm/config/vitest";

export default defineTestConfig(import.meta.url, { environment: "jsdom", setupFiles: ["test/setup.ts"] });
