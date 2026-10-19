import { Button, Container, Group, Text } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { confirmSignUp, SignUpBody, signUp } from "@mm/lib/auth";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useEndpointMutation, useSetSession } from "@/api";
import classes from "@/components/auth/auth.module.css";
import { authErrorMessage } from "@/components/auth/authErrors";
import CodeForm from "@/components/auth/CodeForm";
import GoogleSignIn from "@/components/auth/GoogleSignIn";
import SignUpForm from "@/components/auth/SignUpForm";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { alerts, chudley, malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SIGN_IN_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import pages from "@/styles/pages.module.css";

const SignUpPage = () => {
  useDocumentTitle(ui.pageTitles.signUp);
  const location = useLocation();
  const navigate = useNavigate();
  const setSession = useSetSession();
  const [pendingEmail, setPendingEmail] = useState<string>();

  const form = useForm({
    initialValues: { name: "", email: "" },
    validate: schemaResolver(SignUpBody, { sync: true })
  });

  const signInLocation = { pathname: SIGN_IN_PATH, search: location.search };

  const register = useEndpointMutation(signUp, {
    onSuccess: (_, { body }) => setPendingEmail(body.email)
  });

  const confirm = useEndpointMutation(confirmSignUp, {
    onSuccess: ({ user }, { body }) => {
      if (user) {
        setSession(user);
        return;
      }
      const state: SignInState = { email: body.email, notice: alerts.auth.accountConfirmed };
      void navigate(signInLocation, { state });
    }
  });

  const startOver = () => {
    setPendingEmail(undefined);
    register.reset();
    confirm.reset();
  };

  return (
    <Container size="xs" className={pages.page}>
      <ChudleyHype>{chudley.signUp}</ChudleyHype>
      <MaloSays>{malo.signUp}</MaloSays>

      {pendingEmail ? (
        <CodeForm
          className={classes.form}
          email={pendingEmail}
          submitLabel={ui.auth.confirmAccount}
          pending={confirm.isPending}
          error={confirm.error ? authErrorMessage(confirm.error) : undefined}
          onSubmit={code => confirm.mutate({ body: { email: pendingEmail, code } })}
        >
          <Group justify="space-between">
            <Link to={signInLocation} state={{ email: pendingEmail } satisfies SignInState}>
              {ui.auth.noCodeSignIn}
            </Link>
            <Button variant="subtle" onClick={startOver}>
              {ui.auth.useDifferentEmail}
            </Button>
          </Group>
        </CodeForm>
      ) : (
        <SignUpForm
          form={form}
          pending={register.isPending}
          error={register.error}
          signInLocation={signInLocation}
          onSubmit={body => register.mutate({ body })}
        />
      )}

      {!pendingEmail && <GoogleSignIn />}

      <Text className={classes.switch}>
        {ui.auth.alreadyMember} <Link to={signInLocation}>{ui.auth.signIn}</Link>
      </Text>
    </Container>
  );
};

export default SignUpPage;
