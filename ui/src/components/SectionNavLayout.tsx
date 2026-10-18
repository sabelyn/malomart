import { Container, Title } from "@mantine/core";
import { Suspense } from "react";
import { NavLink, Outlet } from "react-router";

import PageLoader from "@/components/PageLoader";
import pages from "@/pages/pages.module.css";
import classes from "./SectionNavLayout.module.css";

export type SectionLink = { to: string; label: string; end?: boolean };

type SectionNavLayoutProps = {
  title: string;
  navLabel: string;
  sections: SectionLink[];
};

const SectionNavLayout = ({ title, navLabel, sections }: SectionNavLayoutProps) => (
  <Container size="lg" className={pages.page}>
    <Title order={1}>{title}</Title>
    <nav aria-label={navLabel} className={classes.nav}>
      <ul className={classes.navList}>
        {sections.map(({ to, label, end }) => (
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

export default SectionNavLayout;
