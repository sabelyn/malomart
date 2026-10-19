import { Button, Text, Title, VisuallyHidden } from "@mantine/core";
import { Link } from "react-router";

import PriceTag from "@/components/product/PriceTag";
import { ui } from "@/copy";
import { CART_PATH, CHECKOUT_PATH, signInPath, signUpPath } from "@/routes/paths";
import classes from "./cart.module.css";

type CartSummaryProps = {
  subtotal: number;
  signedIn: boolean;
};

const CartSummary = ({ subtotal, signedIn }: CartSummaryProps) => (
  <section aria-labelledby="cart-summary-heading" className={classes.summary}>
    <Title order={2} id="cart-summary-heading" className={classes.summaryHeading}>
      {ui.cart.summary}
    </Title>
    <div aria-hidden="true" className={classes.subtotal}>
      <Text className={classes.subtotalLabel}>{ui.common.subtotal}</Text>
      <PriceTag price={subtotal} />
    </div>
    <VisuallyHidden>{ui.cart.subtotalLabel(subtotal)}</VisuallyHidden>
    {signedIn ? (
      <Button component={Link} to={CHECKOUT_PATH} size="lg" fullWidth>
        {ui.cart.proceedToCheckout}
      </Button>
    ) : (
      <>
        <Text className={classes.membersOnly}>{ui.cart.membersOnly}</Text>
        <Button component={Link} to={signInPath(CART_PATH)} size="lg" fullWidth>
          {ui.cart.signInToCheckOut}
        </Button>
        <Text className={classes.signUp}>
          {ui.cart.newHere} <Link to={signUpPath(CART_PATH)}>{ui.cart.createAccount}</Link>
        </Text>
      </>
    )}
  </section>
);

export default CartSummary;
