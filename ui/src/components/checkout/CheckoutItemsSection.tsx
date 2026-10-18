import { Title } from "@mantine/core";
import { Link } from "react-router";

import { CART_PATH } from "@/routes/paths";
import classes from "./checkout.module.css";
import type { CheckoutItem } from "./CheckoutItems";
import CheckoutItems from "./CheckoutItems";

const CheckoutItemsSection = ({ items }: { items: CheckoutItem[] }) => (
  <section aria-labelledby="checkout-items-heading">
    <div className={classes.sectionHeader}>
      <Title order={2} id="checkout-items-heading" className={classes.sectionTitle}>
        Your items
      </Title>
      <Link to={CART_PATH} className={classes.headerLink}>
        Edit cart
      </Link>
    </div>
    <CheckoutItems items={items} />
  </section>
);

export default CheckoutItemsSection;
