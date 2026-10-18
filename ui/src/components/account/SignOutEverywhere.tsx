import { Button, Text } from "@mantine/core";
import { signOutEverywhere } from "@mm/lib/auth";

import { useEndpointMutation } from "@/api";
import { SIGN_IN_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import { useExitSession } from "@/routes/sessionExit";
import classes from "./account.module.css";

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

export default SignOutEverywhere;
