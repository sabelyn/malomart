import { Container } from "@mantine/core";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router";

import { useCart } from "@/components/cart/CartProvider";
import ErrorBoundary from "@/components/layout/ErrorBoundary";
import GitHubIcon from "@/components/layout/GitHubIcon";
import PageError from "@/components/layout/PageError";
import SiteHeader from "@/components/layout/SiteHeader";
import PageLoader from "@/components/PageLoader";
import { ui } from "@/copy";
import { CREDITS_PATH, PRIVACY_PATH, TERMS_PATH } from "@/routes/paths";
import classes from "./Layout.module.css";

const REPO_URL = "https://github.com/sabelyn/malomart";

const Layout = () => {
  const { pathname } = useLocation();
  const { reset } = useQueryErrorResetBoundary();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const cart = useCart();

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [pathname]);

  return (
    <>
      <a href="#main" className={classes.skipLink}>
        {ui.site.skipLink}
      </a>
      <SiteHeader cartCount={cart.ready ? cart.count : undefined} />
      <main id="main" ref={mainRef} tabIndex={-1} className={classes.main}>
        <ErrorBoundary key={pathname} onReset={reset} fallback={retry => <PageError onRetry={retry} />}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className={classes.footer}>
        <Container size="lg">
          <p>{ui.site.footer}</p>
          <p className={classes.byline}>
            <span>{ui.site.builtBy}</span>
            <a href={REPO_URL} className={classes.repoLink}>
              <GitHubIcon />
              {ui.site.sourceCode}
            </a>
          </p>
          <nav aria-label={ui.site.siteNav} className={classes.siteNav}>
            <Link to={PRIVACY_PATH}>{ui.site.privacy}</Link>
            <Link to={TERMS_PATH}>{ui.site.terms}</Link>
            <Link to={CREDITS_PATH}>{ui.site.credits}</Link>
          </nav>
          <p className={classes.fineprint}>{ui.site.nintendo}</p>
        </Container>
      </footer>
    </>
  );
};

export default Layout;
