import { apiRoot, auth, customers, orders, products } from "@mm/lib";
import { Router } from "express";

import authRouter from "./auth";
import customersRouter from "./customers";
import ordersRouter from "./orders";
import productsRouter from "./products";

const routes = Router();
routes.use(auth.expressPath, authRouter);
routes.use(customers.expressPath, customersRouter);
routes.use(orders.expressPath, ordersRouter);
routes.use(products.expressPath, productsRouter);

const api = Router();
api.use(apiRoot.expressPath, routes);

export default api;
