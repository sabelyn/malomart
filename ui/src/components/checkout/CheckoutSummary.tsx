import { Alert, Button, Text, Title } from "@mantine/core";

import cartClasses from "@/components/cart/cart.module.css";
import PriceTag, { formatRupees } from "@/components/product/PriceTag";
import classes from "./checkout.module.css";
import { shippingCostLabel } from "./checkoutDisplay";

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
      Order summary
    </Title>
    <dl className={classes.totals}>
      <div>
        <dt>Subtotal</dt>
        <dd>{formatRupees(subtotal)} rupees</dd>
      </div>
      <div>
        <dt>Delivery</dt>
        <dd>{shippingCostLabel(shippingCost)}</dd>
      </div>
    </dl>
    <Text className={classes.totalLabel}>Total</Text>
    <PriceTag price={subtotal + shippingCost} />
    {error && (
      <Alert role="alert" variant="light" color="red" title="Order not placed">
        {error}
      </Alert>
    )}
    <Button size="lg" fullWidth loading={placing} onClick={onPlaceOrder}>
      Place order
    </Button>
  </section>
);

export default CheckoutSummary;
