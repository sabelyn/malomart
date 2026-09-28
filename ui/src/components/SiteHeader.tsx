import { Container, Group, VisuallyHidden } from "@mantine/core";

import classes from "./SiteHeader.module.css";

type SiteHeaderProps = {
  cartCount: number;
};

const SiteHeader = ({ cartCount }: SiteHeaderProps) => (
  <header className={classes.header}>
    <Container size="lg">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <a href="/" className={classes.brand}>
          <span className={classes.formerly}>
            <VisuallyHidden>Formerly </VisuallyHidden>
            <s>Chudley's Fine Goods and Fancy Trinkets Emporium</s>
          </span>
          <span className={classes.logo}>Malo Mart</span>
          <span className={classes.branch}>Castle Town branch</span>
        </a>
        <nav aria-label="Main" className={classes.nav}>
          <Group gap="lg">
            <a href="/">Shop</a>
            <a href="/cart">Cart ({cartCount})</a>
          </Group>
        </nav>
      </Group>
    </Container>
  </header>
);

export default SiteHeader;
