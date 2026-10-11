import { tokenizeCard } from "@mm/lib/lambdas";
import { IMAGE_KEY_PREFIX } from "@mm/lib/products";
import babel from "@rolldown/plugin-babel";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { ProxyOptions } from "vite";
import { defineConfig } from "vite";

const OUTPUTS_FILE = path.resolve(__dirname, "../local/cdk-outputs.json");

const deployedProxies = (): Record<string, ProxyOptions> => {
  if (!existsSync(OUTPUTS_FILE)) {
    return {};
  }
  const outputs = JSON.parse(readFileSync(OUTPUTS_FILE, "utf8"));
  const apiUrl = outputs["Dev-MaloMartGatewayStack"]?.ApiUrl;
  const siteUrl = outputs["Dev-MaloMartFrontendStack"]?.SiteUrl;
  return {
    ...(apiUrl && { [tokenizeCard.fullPath]: { target: apiUrl, changeOrigin: true } }),
    ...(siteUrl && { [`/${IMAGE_KEY_PREFIX}`]: { target: siteUrl, changeOrigin: true } })
  };
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
      ...deployedProxies(),
      "/api": "http://localhost:4000"
    }
  }
});
