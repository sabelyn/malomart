import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

type TestConfigOptions = {
  setupFiles?: string[];
};

export const defineTestConfig = (configUrl: string, opts?: TestConfigOptions) => {
  const root = fileURLToPath(new URL(".", configUrl));

  return defineConfig({
    resolve: {
      alias: [{ find: /^@\//, replacement: `${root}src/` }]
    },
    test: {
      root,
      environment: "node",
      globals: true,
      restoreMocks: true,
      setupFiles: opts?.setupFiles ?? [],
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts"]
      },
      projects: [
        {
          extends: true,
          test: {
            name: "unit",
            include: ["test/unit/**/*.test.ts"]
          }
        },
        {
          extends: true,
          test: {
            name: "integration",
            include: ["test/integration/**/*.test.ts"]
          }
        }
      ]
    }
  });
};
