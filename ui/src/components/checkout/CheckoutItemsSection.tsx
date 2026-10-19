import { Title } from "@mantine/core";
import { Link } from "react-router";

import { ui } from "@/copy";
import { CART_PATH } from "@/routes/paths";
import classes from "./checkout.module.css";
import type { CheckoutItem } from "./CheckoutItems";
import CheckoutItems from "./CheckoutItems";

const CheckoutItemsSection = ({ items }: { items: CheckoutItem[] }) => (
  <section aria-labelledby="checkout-items-heading">
    <div className={classes.sectionHeader}>
      <Title order={2} id="checkout-items-heading" className={classes.sectionTitle}>
        {ui.checkout.yourItems}
      </Title>
      <Link to={CART_PATH} className={classes.headerLink}>
        {ui.checkout.editCart}
      </Link>
    </div>
    <CheckoutItems items={items} />
  </section>
);

export default CheckoutItemsSection;
