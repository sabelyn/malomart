import { Container, Group, UnstyledButton, VisuallyHidden } from "@mantine/core";
import { Link, NavLink, useLocation, useNavigate } from "react-router";

import { useSession, useSignOut } from "@/api";
import { signInPath } from "@/routes/paths";
import classes from "./SiteHeader.module.css";

type SiteHeaderProps = {
  cartCount: number;
};

const SignOutButton = () => {
  const navigate = useNavigate();
  const signOut = useSignOut({
    onSignedOut: () => {
      void navigate("/");
      document.getElementById("main")?.focus();
    }
  });

  return (
    <>
      <UnstyledButton className={classes.navButton} onClick={() => signOut.mutate({})} disabled={signOut.isPending}>
        Sign out
      </UnstyledButton>
      {signOut.isError && (
        <span role="alert" className={classes.navError}>
          Couldn't sign you out. Try again.
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
        <NavLink to="/account">Account</NavLink>
        <SignOutButton />
      </>
    );
  }
  return <NavLink to={signInPath(`${pathname}${search}`)}>Sign in</NavLink>;
};

const SiteHeader = ({ cartCount }: SiteHeaderProps) => (
  <header className={classes.header}>
    <Container size="lg">
      <Group justify="space-between" align="center" wrap="wrap" gap="md">
        <div className={classes.brand}>
          <Link to="/" className={classes.logo}>
            Malo Mart
          </Link>
          <p className={classes.formerly}>
            <VisuallyHidden>Formerly </VisuallyHidden>
            <span className={classes.struck}>Chudley's Fine Goods and Fancy Trinkets Emporium</span>
          </p>
          <p className={classes.branch}>Castle Town branch</p>
        </div>
        <nav aria-label="Main" className={classes.nav}>
          <Group gap="lg">
            <NavLink to="/products">Shop</NavLink>
            <NavLink to="/cart" aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}>
              Cart ({cartCount})
            </NavLink>
            <AccountLinks />
          </Group>
        </nav>
      </Group>
    </Container>
  </header>
);

export default SiteHeader;
