import type { OrderDto } from "@mm/lib/orders";
import type { ReactNode } from "react";

import { ui } from "@/copy";
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
    <dt>{ui.orders.shipTo}</dt>
    <dd>
      <address>
        <span>{address.recipient}</span>
        <span>{address.street}</span>
        <span>
          {address.city}, {address.region} {address.postalCode}
        </span>
      </address>
    </dd>
    <dt>{ui.orders.delivery}</dt>
    <dd>{shippingSummary(shipping)}</dd>
    {paymentMethod && (
      <>
        <dt>{ui.orders.paidWith}</dt>
        <dd>{ui.cards.name(paymentMethod.brand, paymentMethod.lastFour)}</dd>
      </>
    )}
    {after}
  </dl>
);

export default OrderFacts;
