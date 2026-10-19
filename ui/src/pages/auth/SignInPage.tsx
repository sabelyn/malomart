import { Button, Container, Group, Text } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { SignInBody, signIn, verifySignIn } from "@mm/lib/auth";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { isUnauthorized, useEndpointMutation, useSetSession } from "@/api";
import classes from "@/components/auth/auth.module.css";
import { authErrorMessage } from "@/components/auth/authErrors";
import CodeForm from "@/components/auth/CodeForm";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import SignInEmailForm from "@/components/auth/SignInEmailForm";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { alerts, chudley, malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SIGN_UP_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const SignInPage = () => {
  useDocumentTitle(ui.pageTitles.signIn);
  const location = useLocation();
  const state = location.state as SignInState | null;
  const setSession = useSetSession();
  const [pendingEmail, setPendingEmail] = useState<string>();
  const [notice, setNotice] = useState(state?.notice);

  const form = useForm({
    initialValues: { email: state?.email ?? "" },
    validate: schemaResolver(SignInBody, { sync: true })
  });

  const start = useEndpointMutation(signIn, {
    onSuccess: (_, { body }) => setPendingEmail(body.email)
  });

  const verify = useEndpointMutation(verifySignIn, {
    onSuccess: user => setSession(user),
    onError: error => {
      if (isUnauthorized(error)) {
        setPendingEmail(undefined);
        setNotice(alerts.auth.sessionTimedOut);
      }
    }
  });

  const startOver = () => {
    setPendingEmail(undefined);
    setNotice(undefined);
    start.reset();
    verify.reset();
  };

  const resend = (email: string) => {
    verify.reset();
    start.mutate({ body: { email } }, { onSuccess: () => setNotice(alerts.auth.newCodeSent) });
  };

  return (
    <Container size="xs" className={pages.page}>
      <ChudleyHype>{chudley.signIn}</ChudleyHype>
      <MaloSays>{malo.signIn}</MaloSays>

      {pendingEmail ? (
        <CodeForm
          className={classes.form}
          email={pendingEmail}
          submitLabel={ui.auth.signIn}
          pending={verify.isPending}
          error={verify.error && !isUnauthorized(verify.error) ? authErrorMessage(verify.error) : undefined}
          notice={notice}
          onSubmit={code => verify.mutate({ body: { code } })}
        >
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => resend(pendingEmail)} loading={start.isPending}>
              {ui.auth.sendNewCode}
            </Button>
            <Button variant="subtle" onClick={startOver}>
              {ui.auth.useDifferentEmail}
            </Button>
          </Group>
        </CodeForm>
      ) : (
        <SignInEmailForm
          form={form}
          pending={start.isPending}
          error={start.error}
          notice={notice}
          onSubmit={email => {
            setNotice(undefined);
            start.mutate({ body: { email } });
          }}
        />
      )}

      {!pendingEmail && <GoogleSignIn showError />}

      <Text className={classes.switch}>
        {ui.auth.newHere} <Link to={{ pathname: SIGN_UP_PATH, search: location.search }}>{ui.auth.makeAccount}</Link>
      </Text>
    </Container>
  );
};

export default SignInPage;
