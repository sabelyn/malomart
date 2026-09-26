import "reflect-metadata";

import cors from "cors";
import express from "express";
import type { Server } from "http";

import { registerDependencies } from "@/container";
import { error, identity } from "@/middleware";
import api from "@/routes";
import env from "./env";

const app = express();
app.use(cors({
  origin: env.FRONTEND_URL,
  allowedHeaders: "Content-Type, Authorization"
}));

app.get("/health", (_req, res) => res.sendStatus(200));

app.use(identity);
app.use(api);
app.use(error);

const SHUTDOWN_TIMEOUT_MS = 20_000;

const start = () => {
  const shutdown = (server: Server, signal?: NodeJS.Signals) => {
    console.log(`Received ${signal}, shutting down.`);
    server.close(err => {
      if (err) {
        console.error("Error while closing server.", err);
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      console.error("Shutdown timed out, closing remaining connections.");
      server.closeAllConnections();
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();
  };

  registerDependencies();
  const server = app.listen(env.PORT, () => console.log(`API is listening on port ${env.PORT}.`));
  process.once("SIGTERM", signal => shutdown(server, signal));
  process.once("SIGINT", signal => shutdown(server, signal));
}

start();
