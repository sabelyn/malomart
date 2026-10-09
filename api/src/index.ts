import "reflect-metadata";

import cookieParser from "cookie-parser";
import express from "express";
import type { Server } from "http";

import { registerDependencies } from "@/container";
import { error, fetchMetadata, identity } from "@/middleware";
import api from "@/routes";
import env from "./env";
import { buildSpec } from "./swagger";

const app = express();

app.get("/health", (_req, res) => res.sendStatus(200));

if (env.NODE_ENV === "development") {
  const spec = buildSpec();
  app.get("/openapi.json", (_req, res) => {
    res.json(spec);
  });

  const docs = import("swagger-ui-express").then(({ default: swaggerUi }) =>
    express.Router().use(
      swaggerUi.serve,
      swaggerUi.setup(undefined, {
        customSiteTitle: "Malomart API",
        swaggerOptions: { url: "/openapi.json", displayRequestDuration: true, tryItOutEnabled: true }
      })
    )
  );
  app.use("/docs", (req, res, next) => {
    docs.then(router => router(req, res, next), next);
  });

  app.get("/", (_req, res) => {
    res.redirect("/docs");
  });
}

app.use(express.json());
app.use(cookieParser());
app.use(fetchMetadata);
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
  const server = app.listen(env.PORT, err => {
    if (err) {
      throw err;
    }
    console.log(`API is listening on port ${env.PORT}.`);
  });
  process.once("SIGTERM", signal => shutdown(server, signal));
  process.once("SIGINT", signal => shutdown(server, signal));
};

start();
