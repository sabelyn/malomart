import { Alert, Button, Container, Group, Stack, Text, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { SignInBody, signIn, verifySignIn } from "@mm/lib/auth";
import { useState } from "react";
import { Link, useLocation } from "react-router";

import { isUnauthorized, useEndpointMutation, useSetSession } from "@/api";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SIGN_UP_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import pages from "../pages.module.css";
import classes from "./auth.module.css";
import { authErrorMessage, SESSION_TIMED_OUT } from "./authErrors";
import CodeForm from "./CodeForm";

const SignInPage = () => {
  useDocumentTitle("Sign in");
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
        setNotice(SESSION_TIMED_OUT);
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
    start.mutate({ body: { email } }, { onSuccess: () => setNotice("New code sent.") });
  };

  return (
    <Container size="xs" className={pages.page}>
      <ChudleyHype>Welcome back, valued customer!</ChudleyHype>
      <MaloSays>Email. Code. Shop.</MaloSays>

      {pendingEmail ? (
        <CodeForm
          email={pendingEmail}
          submitLabel="Sign in"
          pending={verify.isPending}
          error={verify.error && !isUnauthorized(verify.error) ? authErrorMessage(verify.error) : undefined}
          notice={notice}
          onSubmit={code => verify.mutate({ body: { code } })}
        >
          <Group justify="space-between">
            <Button variant="subtle" onClick={() => resend(pendingEmail)} loading={start.isPending}>
              Send a new code
            </Button>
            <Button variant="subtle" onClick={startOver}>
              Use a different email
            </Button>
          </Group>
        </CodeForm>
      ) : (
        <form
          className={classes.form}
          onSubmit={form.onSubmit(({ email }) => {
            setNotice(undefined);
            start.mutate({ body: { email: email.trim() } });
          })}
          noValidate
        >
          <Stack>
            {start.error && (
              <Alert color="red" variant="light">
                {authErrorMessage(start.error)}
              </Alert>
            )}
            {notice && (
              <Alert variant="light" role="status">
                {notice}
              </Alert>
            )}
            <TextInput label="Email" type="email" autoComplete="email" required {...form.getInputProps("email")} />
            <Button type="submit" loading={start.isPending}>
              Email me a code
            </Button>
          </Stack>
        </form>
      )}

      <Text className={classes.switch}>
        New here? <Link to={{ pathname: SIGN_UP_PATH, search: location.search }}>Make an account</Link>
      </Text>
    </Container>
  );
};

export default SignInPage;
