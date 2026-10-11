import { Container, Title } from "@mantine/core";
import { Suspense } from "react";
import { NavLink, Outlet } from "react-router";

import PageLoader from "@/components/PageLoader";
import pages from "../pages.module.css";
import classes from "./account.module.css";

const SECTIONS = [
  { to: "/account", label: "Profile", end: true },
  { to: "/account/addresses", label: "Addresses" },
  { to: "/account/payment-methods", label: "Payment methods" },
  { to: "/account/orders", label: "Orders" }
];

const AccountPage = () => (
  <Container size="lg" className={pages.page}>
    <Title order={1}>Your account</Title>
    <nav aria-label="Account sections" className={classes.nav}>
      <ul className={classes.navList}>
        {SECTIONS.map(({ to, label, end }) => (
          <li key={to}>
            <NavLink to={to} end={end} className={classes.navLink}>
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
    <div className={classes.section}>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </div>
  </Container>
);

export default AccountPage;
