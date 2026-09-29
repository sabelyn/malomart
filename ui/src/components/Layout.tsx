import { Container } from "@mantine/core";
import { useQueryErrorResetBoundary } from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router";

import ErrorBoundary from "@/components/ErrorBoundary";
import PageError from "@/components/PageError";
import PageLoader from "@/components/PageLoader";
import SiteHeader from "@/components/SiteHeader";
import classes from "./Layout.module.css";

export type LayoutContext = {
  addToCart: () => void;
};

export const useLayoutContext = () => useOutletContext<LayoutContext>();

const Layout = () => {
  const { pathname } = useLocation();
  const { reset } = useQueryErrorResetBoundary();
  const mainRef = useRef<HTMLElement>(null);
  const previousPathname = useRef(pathname);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    if (previousPathname.current === pathname) {
      return;
    }
    previousPathname.current = pathname;
    window.scrollTo(0, 0);
    mainRef.current?.focus();
  }, [pathname]);

  const context: LayoutContext = { addToCart: () => setCartCount(count => count + 1) };

  return (
    <>
      <a href="#main" className={classes.skipLink}>
        Skip to content
      </a>
      <SiteHeader cartCount={cartCount} />
      <main id="main" ref={mainRef} tabIndex={-1} className={classes.main}>
        <ErrorBoundary key={pathname} onReset={reset} fallback={retry => <PageError onRetry={retry} />}>
          <Suspense fallback={<PageLoader />}>
            <Outlet context={context} />
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className={classes.footer}>
        <Container size="lg">
          <p>Come back with more rupees.</p>
          <p className={classes.credits}>
            Item icons ripped by Colbydude. Rupee art by Side__Steppa. The Legend of Zelda belongs to Nintendo.
          </p>
        </Container>
      </footer>
    </>
  );
};

export default Layout;
