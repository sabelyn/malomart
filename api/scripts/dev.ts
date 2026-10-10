import { spawn } from "child_process";
import { existsSync } from "fs";
import path from "path";
import { build } from "vite";

const root = path.resolve(__dirname, "..");
const envFile = path.join(root, ".env.local");

if (!existsSync(envFile)) {
  console.error(`Missing ${envFile}. Run "pnpm env:dev" after deploying the Dev stage.`);
  process.exit(1);
}

const main = async () => {
  await build({ root, build: { minify: false } });

  const children = [
    spawn(
      process.execPath,
      [path.join(root, "node_modules/vite/bin/vite.js"), "build", "--watch", "--minify", "false"],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"]
      }
    ),
    spawn(
      process.execPath,
      ["--watch", "--enable-source-maps", `--env-file=${envFile}`, path.join(root, "dist/index.mjs")],
      { cwd: root, stdio: "inherit" }
    )
  ];

  const stop = () => children.forEach(child => child.kill());
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  for (const child of children) {
    child.on("exit", code => {
      stop();
      process.exit(code ?? 0);
    });
  }
};

void main();
