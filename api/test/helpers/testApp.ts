import cookieParser from "cookie-parser";
import express from "express";
import type { Router } from "express";
import { container } from "tsyringe";

import { error } from "@/middleware/error";
import type { User } from "@/types/user";

export const USER_HEADER = "x-test-user";

export const asUser = (user: User) => ({ [USER_HEADER]: JSON.stringify(user) });
export const asRegularUser = asUser({
  id: "user-123",
  email: "user@example.com",
  name: "Regular User",
  isAdmin: false,
  customerData: {}
});
export const asAdmin = asUser({
  id: "admin-123",
  email: "admin@example.com",
  name: "Admin User",
  isAdmin: true,
  customerData: {}
});

export const createTestApp = (router: Router) => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    req.container = container;
    const user = req.get(USER_HEADER);
    if (user) {
      req.user = JSON.parse(user);
    }
    next();
  });
  app.use(router);
  app.use(error);
  return app;
};
