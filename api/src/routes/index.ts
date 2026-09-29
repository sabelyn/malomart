import { Router } from "express";
import { apiRoot, auth, products } from "@mm/lib";

import authRouter from "./auth";
import productsRouter from "./products";

const routes = Router();
routes.use(auth.expressPath, authRouter);
routes.use(products.expressPath, productsRouter);

const api = Router();
api.use(apiRoot.expressPath, routes);

export default api;
