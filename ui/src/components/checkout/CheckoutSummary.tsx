import { Alert, Button, Text, Title } from "@mantine/core";

import cartClasses from "@/components/cart/cart.module.css";
import PriceTag from "@/components/product/PriceTag";
import { alerts, rupees, ui } from "@/copy";
import classes from "./checkout.module.css";

type CheckoutSummaryProps = {
  subtotal: number;
  shippingCost: number;
  error?: string;
  placing: boolean;
  onPlaceOrder: () => void;
};

const CheckoutSummary = ({ subtotal, shippingCost, error, placing, onPlaceOrder }: CheckoutSummaryProps) => (
  <section aria-labelledby="checkout-summary-heading" className={`${cartClasses.summary} ${classes.summary}`}>
    <Title order={2} id="checkout-summary-heading" className={cartClasses.summaryHeading}>
      {ui.checkout.orderSummary}
    </Title>
    <dl className={classes.totals}>
      <div>
        <dt>{ui.common.subtotal}</dt>
        <dd>{rupees(subtotal)}</dd>
      </div>
      <div>
        <dt>{ui.common.delivery}</dt>
        <dd>{ui.common.shippingCost(shippingCost)}</dd>
      </div>
    </dl>
    <Text className={classes.totalLabel}>{ui.common.total}</Text>
    <PriceTag price={subtotal + shippingCost} />
    {error && (
      <Alert role="alert" variant="light" color="red" title={alerts.checkout.orderNotPlaced}>
        {error}
      </Alert>
    )}
    <Button size="lg" fullWidth loading={placing} onClick={onPlaceOrder}>
      {ui.checkout.placeOrder}
    </Button>
  </section>
);

export default CheckoutSummary;
