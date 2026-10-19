import type { OrderDto } from "@mm/lib/orders";
import { getOrderSubtotal, getOrderTotal } from "@mm/lib/orders";

import { rupees, ui } from "@/copy";
import classes from "./orders.module.css";

type OrderTotalsProps = {
  order: OrderDto;
};

const OrderTotals = ({ order }: OrderTotalsProps) => (
  <dl className={classes.totals}>
    <div>
      <dt>{ui.common.subtotal}</dt>
      <dd>{rupees(getOrderSubtotal(order.products))}</dd>
    </div>
    <div>
      <dt>{ui.common.delivery}</dt>
      <dd>{ui.common.shippingCost(order.shipping.cost)}</dd>
    </div>
    <div className={classes.grandTotal}>
      <dt>{ui.common.total}</dt>
      <dd>{rupees(getOrderTotal(order))}</dd>
    </div>
  </dl>
);

export default OrderTotals;
