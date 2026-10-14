import { cancelOrder, createOrder, getOrder, listOrders } from "@mm/lib/orders";
import { Router } from "express";

import { ORDER_SERVICE } from "@/contracts/tokens";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "./helpers";

const router = Router();

router.get(...pathAndMiddleware(listOrders), async (req, res, next) => {
  try {
    const { query } = validateRequest(listOrders, req);

    const service = req.container.resolve(ORDER_SERVICE);
    const result = await service.listOrders(query);
    return respond(res, listOrders, result);
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(getOrder), async (req, res, next) => {
  try {
    const {
      params: { id }
    } = validateRequest(getOrder, req);

    const service = req.container.resolve(ORDER_SERVICE);
    const order = await service.getOrder(id);
    return respond(res, getOrder, order);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(createOrder), async (req, res, next) => {
  try {
    const { body } = validateRequest(createOrder, req);

    const service = req.container.resolve(ORDER_SERVICE);
    const order = await service.createOrder(body);
    return respond(res, createOrder, order);
  } catch (err) {
    return next(err);
  }
});

router.put(...pathAndMiddleware(cancelOrder), async (req, res, next) => {
  try {
    const {
      params: { id }
    } = validateRequest(cancelOrder, req);

    const service = req.container.resolve(ORDER_SERVICE);
    await service.cancelOrder(id);
    return respondEmpty(res, cancelOrder);
  } catch (err) {
    return next(err);
  }
});

export default router;
