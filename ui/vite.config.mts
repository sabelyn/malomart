import { tokenizeCard } from "@mm/lib/lambdas";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { ProxyOptions } from "vite";
import { defineConfig } from "vite";

const OUTPUTS_FILE = path.resolve(__dirname, "../local/cdk-outputs.json");

const gatewayProxy = (): Record<string, ProxyOptions> => {
  if (!existsSync(OUTPUTS_FILE)) {
    return {};
  }
  const target = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"))["Dev-MaloMartGatewayStack"]?.ApiUrl;
  return target ? { [tokenizeCard.fullPath]: { target, changeOrigin: true } } : {};
};

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src")
    }
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
  server: {
    proxy: {
      ...gatewayProxy(),
      "/api": "http://localhost:4000"
    }
  }
});
