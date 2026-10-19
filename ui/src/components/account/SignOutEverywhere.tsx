import { Button, Text } from "@mantine/core";
import { signOutEverywhere } from "@mm/lib/auth";

import { useEndpointMutation } from "@/api";
import { alerts, ui } from "@/copy";
import { SIGN_IN_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import { useExitSession } from "@/routes/sessionExit";
import classes from "./account.module.css";

const SignOutEverywhere = ({ email }: { email: string }) => {
  const exitSession = useExitSession();

  const signOut = useEndpointMutation(signOutEverywhere, {
    onSuccess: () => {
      const state: SignInState = { email, notice: alerts.auth.signedOutEverywhere };
      exitSession(SIGN_IN_PATH, state);
    }
  });

  return (
    <>
      <Text className={classes.blurb}>{ui.profile.signOutEverywhereBlurb}</Text>
      {signOut.isError && (
        <Text role="alert" className={classes.error}>
          {alerts.profile.signOutEverywhereFailed}
        </Text>
      )}
      <Button variant="outline" loading={signOut.isPending} onClick={() => signOut.mutate({})}>
        {ui.profile.signOutEverywhere}
      </Button>
    </>
  );
};

export default SignOutEverywhere;
