import { ApiRequestError } from "@mm/lib/api";

import { alerts } from "@/copy";

export const isStaleOrder = (err: unknown) =>
  err instanceof ApiRequestError && (err.status === 404 || err.status === 409);

export const orderErrorMessage = (err: unknown) => {
  if (isStaleOrder(err)) {
    return alerts.checkout.staleOrder;
  }
  if (err instanceof ApiRequestError && err.status === 400) {
    return alerts.checkout.invalidOrder;
  }
  return alerts.checkout.orderFailed;
};
