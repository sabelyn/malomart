import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const src = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\//, replacement: `${src}/` }
    ]
  },
  ssr: {
    target: "node",
    noExternal: true
  },
  build: {
    ssr: "src/index.ts",
    outDir: "dist",
    target: "node24",
    minify: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        format: "esm",
        entryFileNames: "index.mjs"
      }
    }
  }
});
