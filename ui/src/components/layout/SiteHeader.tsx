import { Container, Group, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { Link, NavLink, useLocation } from "react-router";

import { useSession, useSignOut } from "@/api";
import maloMartSign from "@/assets/malo-mart-sign.webp";
import { alerts, ui } from "@/copy";
import { ACCOUNT_PATH, ADMIN_PATH, CART_PATH, CATALOG_PATH, HOME_PATH, signInPath } from "@/routes/paths";
import { useExitSession } from "@/routes/sessionExit";
import classes from "./SiteHeader.module.css";

type SiteHeaderProps = {
  cartCount?: number;
};

const CartLink = ({ count }: { count?: number }) =>
  count === undefined ? (
    <NavLink to={CART_PATH}>{ui.site.cart}</NavLink>
  ) : (
    <NavLink to={CART_PATH} aria-label={ui.site.cartLabel(count)}>
      {ui.site.cartWithCount(count)}
    </NavLink>
  );

const SignOutButton = () => {
  const exitSession = useExitSession();
  const signOut = useSignOut({
    onSignedOut: () => {
      exitSession("/");
      document.getElementById("main")?.focus();
    }
  });

  return (
    <>
      <UnstyledButton className={classes.navButton} onClick={() => signOut.mutate({})} disabled={signOut.isPending}>
        {ui.site.signOut}
      </UnstyledButton>
      {signOut.isError && (
        <span role="alert" className={classes.navError}>
          {alerts.signOutFailed}
        </span>
      )}
    </>
  );
};

const AccountLinks = () => {
  const { data: user, isPending } = useSession();
  const { pathname, search } = useLocation();

  if (isPending) {
    return null;
  }
  if (user) {
    return (
      <>
        {user.isAdmin && <NavLink to={ADMIN_PATH}>{ui.site.backOffice}</NavLink>}
        <NavLink to={ACCOUNT_PATH}>{ui.site.account}</NavLink>
        <SignOutButton />
      </>
    );
  }
  return <NavLink to={signInPath(`${pathname}${search}`)}>{ui.site.signIn}</NavLink>;
};

const SiteHeader = ({ cartCount }: SiteHeaderProps) => (
  <header className={classes.header}>
    <Container size="lg">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <div className={classes.brand}>
          <Link to={HOME_PATH} className={classes.logo}>
            <img src={maloMartSign} alt="" className={classes.sign} />
            {ui.site.name}
          </Link>
          <p className={classes.formerly}>
            <VisuallyHidden>{ui.site.formerlyPrefix}</VisuallyHidden>
            <span className={classes.struck}>{ui.site.formerName}</span>
          </p>
        </div>
        <nav aria-label={ui.site.mainNav} className={classes.nav}>
          <Group gap="lg">
            <NavLink to={CATALOG_PATH}>{ui.site.shop}</NavLink>
            <CartLink count={cartCount} />
            <AccountLinks />
          </Group>
        </nav>
      </Group>
    </Container>
  </header>
);

export default SiteHeader;
