import type { OrderDto } from "@mm/lib/orders";
import type { ReactNode } from "react";

import { shippingSummary } from "./orderDisplay";
import classes from "./orders.module.css";

type OrderFactsProps = {
  order: Pick<OrderDto, "address" | "shipping" | "paymentMethod">;
  before?: ReactNode;
  after?: ReactNode;
};

const OrderFacts = ({ order: { address, shipping, paymentMethod }, before, after }: OrderFactsProps) => (
  <dl className={classes.facts}>
    {before}
    <dt>Ship to</dt>
    <dd>
      <address>
        <span>{address.recipient}</span>
        <span>{address.street}</span>
        <span>
          {address.city}, {address.region} {address.postalCode}
        </span>
      </address>
    </dd>
    <dt>Delivery</dt>
    <dd>{shippingSummary(shipping)}</dd>
    {paymentMethod && (
      <>
        <dt>Paid with</dt>
        <dd>
          {paymentMethod.brand} ending in {paymentMethod.lastFour}
        </dd>
      </>
    )}
    {after}
  </dl>
);

export default OrderFacts;
