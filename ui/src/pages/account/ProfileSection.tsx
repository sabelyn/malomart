import { Alert, Button, Text, Title } from "@mantine/core";
import { GOOGLE_ERROR_PARAM, GoogleSignInError } from "@mm/lib/auth";
import { useState } from "react";
import { useSearchParams } from "react-router";

import { useSession } from "@/api";
import classes from "@/components/account/account.module.css";
import AccountDefaults from "@/components/account/AccountDefaults";
import ChangeEmailModal from "@/components/account/ChangeEmailModal";
import ChangeNameModal from "@/components/account/ChangeNameModal";
import DeleteAccountModal from "@/components/account/DeleteAccountModal";
import ProfileFacts from "@/components/account/ProfileFacts";
import SignOutEverywhere from "@/components/account/SignOutEverywhere";
import SectionHeader from "@/components/layout/SectionHeader";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useExitSession } from "@/routes/sessionExit";

type OpenModal = "name" | "email" | "delete";

const GOOGLE_DELETION_ERRORS: Record<GoogleSignInError, string> = {
  cancelled: "Google check cancelled. Your account is still here.",
  failed: "Couldn't confirm with Google, so your account is still here. Try again.",
  wrongAccount: "That's a different Google account. Use the one you sign in with here."
};

const ProfileSection = () => {
  useDocumentTitle("Your account");
  const exitSession = useExitSession();
  const { data: user } = useSession();
  const [openModal, setOpenModal] = useState<OpenModal>();
  const [status, setStatus] = useState("");
  const [searchParams] = useSearchParams();
  const googleError = GoogleSignInError.safeParse(searchParams.get(GOOGLE_ERROR_PARAM));

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
      <SectionHeader id="profile-heading" title="Profile" />
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      <ProfileFacts user={user} onChangeName={() => setOpenModal("name")} onChangeEmail={() => setOpenModal("email")} />

      <Title order={3} className={classes.subheading}>
        Defaults
      </Title>
      <AccountDefaults />

      <Title order={3} className={classes.subheading}>
        Devices
      </Title>
      <SignOutEverywhere email={user.email} />

      <Title order={3} className={classes.subheading}>
        Close your account
      </Title>
      <MaloSays>Leaving? Fine. Your addresses and cards go with you. No take-backs.</MaloSays>
      {googleError.success && (
        <Alert mt="lg" color="red" variant="light">
          {GOOGLE_DELETION_ERRORS[googleError.data]}
        </Alert>
      )}
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
      <DeleteAccountModal
        opened={openModal === "delete"}
        email={user.email}
        signInMethod={user.signInMethod}
        onCancel={close}
        onDeleted={deleted}
      />
    </section>
  );
};

export default ProfileSection;
