import {
  createAddress,
  createPaymentMethod,
  deleteAddress,
  deletePaymentMethod,
  getCustomer,
  listAddresses,
  listPaymentMethods,
  updateAddress,
  updatePaymentMethod
} from "@mm/lib/customers";
import { Router } from "express";

import { CUSTOMER_SERVICE, PAYMENT_METHOD_SERVICE } from "@/contracts/tokens";
import { pathAndMiddleware, respond, respondEmpty, validateRequest } from "./helpers";

const router = Router();

router.get(...pathAndMiddleware(getCustomer), async (req, res, next) => {
  try {
    const service = req.container.resolve(CUSTOMER_SERVICE);
    const customer = await service.getCustomer();
    return respond(res, getCustomer, customer);
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(listAddresses), async (req, res, next) => {
  try {
    const service = req.container.resolve(CUSTOMER_SERVICE);
    const addresses = await service.listAddresses();
    return respond(res, listAddresses, addresses);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(createAddress), async (req, res, next) => {
  try {
    const { body } = validateRequest(createAddress, req);

    const service = req.container.resolve(CUSTOMER_SERVICE);
    const address = await service.createAddress(body);
    return respond(res, createAddress, address);
  } catch (err) {
    return next(err);
  }
});

router.put(...pathAndMiddleware(updateAddress), async (req, res, next) => {
  try {
    const {
      body,
      params: { id }
    } = validateRequest(updateAddress, req);

    const service = req.container.resolve(CUSTOMER_SERVICE);
    const address = await service.updateAddress(id, body);
    return respond(res, updateAddress, address);
  } catch (err) {
    return next(err);
  }
});

router.delete(...pathAndMiddleware(deleteAddress), async (req, res, next) => {
  try {
    const {
      params: { id }
    } = validateRequest(deleteAddress, req);

    const service = req.container.resolve(CUSTOMER_SERVICE);
    await service.deleteAddress(id);
    return respondEmpty(res, deleteAddress);
  } catch (err) {
    return next(err);
  }
});

router.get(...pathAndMiddleware(listPaymentMethods), async (req, res, next) => {
  try {
    const service = req.container.resolve(PAYMENT_METHOD_SERVICE);
    const paymentMethods = await service.listPaymentMethods();
    return respond(res, listPaymentMethods, paymentMethods);
  } catch (err) {
    return next(err);
  }
});

router.post(...pathAndMiddleware(createPaymentMethod), async (req, res, next) => {
  try {
    const { body } = validateRequest(createPaymentMethod, req);

    const service = req.container.resolve(PAYMENT_METHOD_SERVICE);
    const paymentMethod = await service.createPaymentMethod(body);
    return respond(res, createPaymentMethod, paymentMethod);
  } catch (err) {
    return next(err);
  }
});

router.put(...pathAndMiddleware(updatePaymentMethod), async (req, res, next) => {
  try {
    const {
      body,
      params: { id }
    } = validateRequest(updatePaymentMethod, req);

    const service = req.container.resolve(PAYMENT_METHOD_SERVICE);
    const paymentMethod = await service.updatePaymentMethod(id, body);
    return respond(res, updatePaymentMethod, paymentMethod);
  } catch (err) {
    return next(err);
  }
});

router.delete(...pathAndMiddleware(deletePaymentMethod), async (req, res, next) => {
  try {
    const {
      params: { id }
    } = validateRequest(deletePaymentMethod, req);

    const service = req.container.resolve(PAYMENT_METHOD_SERVICE);
    await service.deletePaymentMethod(id);
    return respondEmpty(res, deletePaymentMethod);
  } catch (err) {
    return next(err);
  }
});

export default router;
