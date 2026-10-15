import type { OrderDto } from "@mm/lib/orders";
import { OrderStatus } from "@mm/lib/orders";

import { formatOrderDateTime } from "./orderDisplay";
import classes from "./orders.module.css";

const FLOW: OrderStatus[] = [OrderStatus.Placed, OrderStatus.Confirmed, OrderStatus.Shipped, OrderStatus.Delivered];

const STEP_NOTES: Record<OrderStatus, string> = {
  Placed: "Got your order.",
  Confirmed: "Payment cleared. Packing it now.",
  Shipped: "It left the shop. Out of my hands.",
  Delivered: "Dropped off. Enjoy it, or don't.",
  Cancelled: "Cancelled. Nothing ships."
};

type OrderUpdatesProps = {
  order: Pick<OrderDto, "currentStatus" | "statusUpdates">;
};

const OrderUpdates = ({ order: { currentStatus, statusUpdates } }: OrderUpdatesProps) => {
  const steps =
    currentStatus === OrderStatus.Cancelled
      ? [...FLOW.filter(status => statusUpdates[status]), OrderStatus.Cancelled]
      : FLOW;

  return (
    <ol className={classes.updates}>
      {steps.map(status => {
        const reachedAt = statusUpdates[status];
        const state = status === OrderStatus.Cancelled ? "cancelled" : reachedAt ? "reached" : "pending";
        return (
          <li
            key={status}
            className={classes.update}
            data-state={state}
            aria-current={status === currentStatus ? "step" : undefined}
          >
            <span className={classes.marker} />
            <div>
              <p className={classes.updateStatus}>{status}</p>
              {reachedAt ? (
                <>
                  <p className={classes.updateTime}>
                    <time dateTime={reachedAt}>{formatOrderDateTime(reachedAt)}</time>
                  </p>
                  <p className={classes.updateNote}>{STEP_NOTES[status]}</p>
                </>
              ) : (
                <p className={classes.updateTime}>Not yet.</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderUpdates;
