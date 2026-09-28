import { createDocument } from "zod-openapi";
import { products, routeToPaths, Tags } from "@mm/lib";

export const buildSpec = (serverUrl?: string): ReturnType<typeof createDocument> =>
  createDocument({
    openapi: "3.1.0",
    info: {
      title: "Malomart API",
      version: "0.1.0",
      description: "Express API for the Malomart app."
    },
    ...(serverUrl ? { servers: [{ url: serverUrl.replace(/\/+$/, ""), description: "Deployed stage" }] } : {}),
    tags: Object.entries(Tags).map(([name, description]) => ({ name, description })),
    paths: {
      ...routeToPaths(products)
    }
  });
