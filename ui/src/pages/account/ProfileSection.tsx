import { Anchor, Button, Text, Title } from "@mantine/core";
import { signOutEverywhere } from "@mm/lib/auth";
import { getCustomer } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";

import { endpointQuery, useEndpointMutation, useSession } from "@/api";
import { addressLines, paymentMethodExpiry, paymentMethodName } from "@/components/account/accountDisplay";
import ChangeEmailModal from "@/components/account/ChangeEmailModal";
import ChangeNameModal from "@/components/account/ChangeNameModal";
import DeleteAccountModal from "@/components/account/DeleteAccountModal";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SIGN_IN_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import { useExitSession } from "@/routes/sessionExit";
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

const SignOutEverywhere = ({ email }: { email: string }) => {
  const exitSession = useExitSession();

  const signOut = useEndpointMutation(signOutEverywhere, {
    onSuccess: () => {
      const state: SignInState = { email, notice: "Signed out on every device." };
      exitSession(SIGN_IN_PATH, state);
    }
  });

  return (
    <>
      <Text className={classes.blurb}>
        Lost your Sheikah Slate? This signs you out here and everywhere else. Other devices can take up to 15 minutes to
        notice.
      </Text>
      {signOut.isError && (
        <Text role="alert" className={classes.error}>
          Couldn't sign you out everywhere. Try again.
        </Text>
      )}
      <Button variant="outline" loading={signOut.isPending} onClick={() => signOut.mutate({})}>
        Sign out everywhere
      </Button>
    </>
  );
};

type OpenModal = "name" | "email" | "delete";

const ProfileSection = () => {
  useDocumentTitle("Your account");
  const exitSession = useExitSession();
  const { data: user } = useSession();
  const [openModal, setOpenModal] = useState<OpenModal>();
  const [status, setStatus] = useState("");

  const close = () => setOpenModal(undefined);

  const saved = (message: string) => {
    setStatus(message);
    close();
  };

  const deleted = () => {
    exitSession("/");
    document.getElementById("main")?.focus();
  };

  if (!user) {
    return null;
  }

  return (
    <section aria-labelledby="profile-heading">
      <div className={classes.sectionHeader}>
        <Title order={2} id="profile-heading" className={classes.sectionTitle}>
          Profile
        </Title>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      <dl className={classes.facts}>
        <dt>Name</dt>
        <dd>
          <span>{user.name}</span>
          <Anchor
            component="button"
            type="button"
            underline="always"
            className={classes.factLink}
            onClick={() => setOpenModal("name")}
          >
            Change name
          </Anchor>
        </dd>
        <dt>Email</dt>
        <dd>
          <span>{user.email}</span>
          {user.signInMethod === "email" ? (
            <Anchor
              component="button"
              type="button"
              underline="always"
              className={classes.factLink}
              onClick={() => setOpenModal("email")}
            >
              Change email
            </Anchor>
          ) : (
            <span className={classes.factNote}>You sign in with Google, so Google manages this one.</span>
          )}
        </dd>
      </dl>

      <Title order={3} className={classes.subheading}>
        Defaults
      </Title>
      <Defaults />

      <Title order={3} className={classes.subheading}>
        Devices
      </Title>
      <SignOutEverywhere email={user.email} />

      <Title order={3} className={classes.subheading}>
        Close your account
      </Title>
      <MaloSays>Leaving? Fine. Your addresses and cards go with you. No take-backs.</MaloSays>
      <Button mt="lg" color="red.5" variant="outline" onClick={() => setOpenModal("delete")}>
        Delete account
      </Button>

      <ChangeNameModal
        opened={openModal === "name"}
        name={user.name}
        onCancel={close}
        onSaved={() => saved("Name updated.")}
      />
      <ChangeEmailModal
        opened={openModal === "email"}
        currentEmail={user.email}
        onCancel={close}
        onSaved={() => saved("Email updated.")}
      />
      <DeleteAccountModal opened={openModal === "delete"} email={user.email} onCancel={close} onDeleted={deleted} />
    </section>
  );
};

export default ProfileSection;
