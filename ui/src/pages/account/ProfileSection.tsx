import { Button, Title } from "@mantine/core";
import { getCustomer } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointQuery, useSession } from "@/api";
import { addressLines, paymentMethodExpiry, paymentMethodName } from "@/components/account/accountDisplay";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./account.module.css";

const Defaults = () => {
  const { data: customer, isPending, refetch } = useQuery(endpointQuery(getCustomer, {}));

  if (isPending) {
    return <PageLoader />;
  }
  if (!customer) {
    return (
      <div role="alert">
        <MaloSays>Couldn't find your defaults. Not my fault.</MaloSays>
        <Button mt="lg" variant="outline" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const { defaultAddress, defaultPaymentMethod } = customer;
  return (
    <dl className={classes.facts}>
      <dt>Shipping address</dt>
      <dd>
        {defaultAddress ? (
          <address>
            {addressLines(defaultAddress).map(line => (
              <span key={line}>{line}</span>
            ))}
          </address>
        ) : (
          <span>None set.</span>
        )}
        <Link to="/account/addresses" className={classes.factLink}>
          Manage addresses
        </Link>
      </dd>
      <dt>Payment method</dt>
      <dd>
        {defaultPaymentMethod ? (
          <>
            <span>{paymentMethodName(defaultPaymentMethod)}</span>
            <span>{paymentMethodExpiry(defaultPaymentMethod)}</span>
          </>
        ) : (
          <span>None set.</span>
        )}
        <Link to="/account/payment-methods" className={classes.factLink}>
          Manage payment methods
        </Link>
      </dd>
    </dl>
  );
};

const ProfileSection = () => {
  useDocumentTitle("Your account");
  const { data: user } = useSession();

  return (
    <section aria-labelledby="profile-heading">
      <div className={classes.sectionHeader}>
        <Title order={2} id="profile-heading" className={classes.sectionTitle}>
          Profile
        </Title>
      </div>
      <dl className={classes.facts}>
        <dt>Name</dt>
        <dd>{user?.name}</dd>
        <dt>Email</dt>
        <dd>{user?.email}</dd>
      </dl>

      <Title order={3} className={classes.subheading}>
        Defaults
      </Title>
      <Defaults />

      <Title order={3} className={classes.subheading}>
        Account settings
      </Title>
      <MaloSays>Changing your name or email, signing out everywhere, closing your account. Not built yet.</MaloSays>
    </section>
  );
};

export default ProfileSection;
