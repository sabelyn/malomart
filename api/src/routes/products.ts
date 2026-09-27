import { CreateProductBody, ListProductsQuery, UpdateProductBody } from "@mm/lib";
import { Router } from "express";
import { uuid } from "zod";

import { PRODUCT_SERVICE } from "@/contracts/tokens";
import { requireAdmin } from "@/middleware";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const query = ListProductsQuery.parse(req.query);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const result = await service.listProducts(query);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = uuid().parse(req.params.id);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.getProduct(id);
    return res.json(product);
  } catch (err) {
    return next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const body = CreateProductBody.parse(req.body);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.createProduct(body);
    return res.status(201).json(product);
  } catch (err) {
    return next(err);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = uuid().parse(req.params.id);
    const body = UpdateProductBody.parse(req.body);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.updateProduct(id, body);
    return res.json(product);
  } catch (err) {
    return next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const id = uuid().parse(req.params.id);

    const service = req.container.resolve(PRODUCT_SERVICE);
    await service.deleteProduct(id);
    return res.sendStatus(204);
  } catch (err) {
    return next(err);
  }
});

export default router;
