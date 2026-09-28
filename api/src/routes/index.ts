import { Router } from "express";
import { products } from "@mm/lib";

import productsRouter from "./products";

const api = Router();

api.use(products.expressPath, productsRouter);

export default api;
