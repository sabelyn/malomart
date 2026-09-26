import { Router } from "express";

import products from "./products";

const api = Router();

api.use("/products", products);

export default api;
