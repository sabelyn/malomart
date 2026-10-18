import { Title } from "@mantine/core";
import type { ReactNode } from "react";

import classes from "./orders.module.css";

type OrderSectionProps = {
  id: string;
  title: string;
  children: ReactNode;
};

const OrderSection = ({ id, title, children }: OrderSectionProps) => (
  <section aria-labelledby={id} className={classes.section}>
    <Title order={2} id={id} className={classes.sectionTitle}>
      {title}
    </Title>
    {children}
  </section>
);

export default OrderSection;
