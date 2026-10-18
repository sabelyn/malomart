import { Button, Text, Title } from "@mantine/core";
import { Link } from "react-router";

import PriceTag from "@/components/product/PriceTag";
import { CART_PATH, CHECKOUT_PATH, signInPath, signUpPath } from "@/routes/paths";
import classes from "./cart.module.css";

type CartSummaryProps = {
  count: number;
  subtotal: number;
  signedIn: boolean;
};

const CartSummary = ({ count, subtotal, signedIn }: CartSummaryProps) => (
  <section aria-labelledby="cart-summary-heading" className={classes.summary}>
    <Title order={2} id="cart-summary-heading" className={classes.summaryHeading}>
      Summary
    </Title>
    <Text className={classes.subtotalLabel}>
      Subtotal, {count} {count === 1 ? "item" : "items"}
    </Text>
    <PriceTag price={subtotal} />
    {signedIn ? (
      <Button component={Link} to={CHECKOUT_PATH} size="lg" fullWidth>
        Proceed to checkout
      </Button>
    ) : (
      <>
        <Text className={classes.membersOnly}>Members only at the register. House rules.</Text>
        <Button component={Link} to={signInPath(CART_PATH)} size="lg" fullWidth>
          Sign in to check out
        </Button>
        <Text className={classes.signUp}>
          New here? <Link to={signUpPath(CART_PATH)}>Create an account</Link>
        </Text>
      </>
    )}
  </section>
);

export default CartSummary;
