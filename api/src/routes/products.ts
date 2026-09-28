import { createProduct, deleteProduct, getProduct, listProducts, updateProduct } from "@mm/lib/products";
import { Router } from "express";

import { PRODUCT_SERVICE } from "@/contracts/tokens";
import { pathAndMiddleware, respond } from "./helpers";

const router = Router();

router.get(...pathAndMiddleware(listProducts), async (req, res, next) => {
  try {
    const { query } = listProducts.validateRequest(req);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const result = await service.listProducts(query);
    return respond(res, listProducts, result);
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(getProduct), async (req, res, next) => {
  try {
    const { params: { id } } = getProduct.validateRequest(req);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.getProduct(id);
    return respond(res, getProduct, product);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(createProduct), async (req, res, next) => {
  try {
    const { body } = createProduct.validateRequest(req);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.createProduct(body);
    return respond(res, createProduct, product);
  } catch (err) {
    return next(err);
  }
});

router.put(...pathAndMiddleware(updateProduct), async (req, res, next) => {
  try {
    const { body, params: { id }
    } = updateProduct.validateRequest(req);

    const service = req.container.resolve(PRODUCT_SERVICE);
    const product = await service.updateProduct(id, body);
    return respond(res, updateProduct, product);
  } catch (err) {
    return next(err);
  }
});

router.delete(...pathAndMiddleware(deleteProduct), async (req, res, next) => {
  try {
    const { params: { id } } = deleteProduct.validateRequest(req);

    const service = req.container.resolve(PRODUCT_SERVICE);
    await service.deleteProduct(id);
    return respond(res, deleteProduct);
  } catch (err) {
    return next(err);
  }
});

export default router;
