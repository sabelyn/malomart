import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

type PackageJson = {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

export const defineLibConfig = (configUrl: string, entries: string[]) => {
  const root = fileURLToPath(new URL(".", configUrl));
  const pkg: PackageJson = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
  const deps = Object.keys({ ...pkg.dependencies, ...pkg.peerDependencies });

  return defineConfig({
    resolve: {
      alias: [{ find: /^@\//, replacement: `${root}src/` }]
    },
    build: {
      target: "node24",
      minify: false,
      sourcemap: true,
      copyPublicDir: false,
      lib: {
        entry: entries.map(entry => `${root}${entry}`),
        formats: ["es"],
        fileName: (_format, name) => `${name}.mjs`
      },
      rolldownOptions: {
        external: [/^node:/, ...builtinModules, ...deps.map(dep => new RegExp(`^${dep}(/.*)?$`))],
        output: {
          preserveModules: true,
          preserveModulesRoot: `${root}src`
        }
      }
    }
  });
};
