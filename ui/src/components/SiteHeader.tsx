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
      navigate("/");
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
        <NavLink to="/orders">Orders</NavLink>
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
        <Link to="/" className={classes.brand}>
          <span className={classes.formerly}>
            <VisuallyHidden>Formerly </VisuallyHidden>
            <s>Chudley's Fine Goods and Fancy Trinkets Emporium</s>
          </span>
          <span className={classes.logo}>Malo Mart</span>
          <span className={classes.branch}>Castle Town branch</span>
        </Link>
        <nav aria-label="Main" className={classes.nav}>
          <Group gap="lg">
            <NavLink to="/" end>
              Shop
            </NavLink>
            <NavLink to="/cart">Cart ({cartCount})</NavLink>
            <AccountLinks />
          </Group>
        </nav>
      </Group>
    </Container>
  </header>
);

export default SiteHeader;
