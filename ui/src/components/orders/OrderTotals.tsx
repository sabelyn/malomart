import type { OrderDto } from "@mm/lib/orders";
import { getOrderSubtotal, getOrderTotal } from "@mm/lib/orders";

import { shippingCostLabel } from "@/components/checkout/checkoutDisplay";
import { formatRupees } from "@/components/product/PriceTag";
import classes from "./orders.module.css";

type OrderTotalsProps = {
  order: OrderDto;
};

const OrderTotals = ({ order }: OrderTotalsProps) => (
  <dl className={classes.totals}>
    <div>
      <dt>Subtotal</dt>
      <dd>{formatRupees(getOrderSubtotal(order.products))} rupees</dd>
    </div>
    <div>
      <dt>Delivery</dt>
      <dd>{shippingCostLabel(order.shipping.cost)}</dd>
    </div>
    <div className={classes.grandTotal}>
      <dt>Total</dt>
      <dd>{formatRupees(getOrderTotal(order))} rupees</dd>
    </div>
  </dl>
);

export default OrderTotals;
