import { Alert, Button, Container, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError, ErrorCode } from "@mm/lib/api";
import { confirmSignUp, SignUpBody, signUp } from "@mm/lib/auth";
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";

import { useEndpointMutation, useSetSession } from "@/api";
import MaloSays from "@/components/MaloSays";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { SIGN_IN_PATH } from "@/routes/paths";
import type { SignInState } from "@/routes/paths";
import voices from "@/styles/voices.module.css";
import pages from "../pages.module.css";
import classes from "./auth.module.css";
import { authErrorMessage } from "./authErrors";
import CodeForm from "./CodeForm";

const isAccountExists = (error: unknown) => error instanceof ApiRequestError && error.code === ErrorCode.AccountExists;

const SignUpPage = () => {
  useDocumentTitle("Sign up");
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
      const state: SignInState = { email: body.email, notice: "Account confirmed. Sign in to finish." };
      navigate(signInLocation, { state });
    }
  });

  const startOver = () => {
    setPendingEmail(undefined);
    register.reset();
    confirm.reset();
  };

  const existingEmail = form.values.email.trim();

  return (
    <Container size="xs" className={pages.page}>
      <Title order={1} className={voices.hype}>
        Join the Malo Mart family! Membership is free!
      </Title>
      <MaloSays>No passwords. I don't trust you with one.</MaloSays>

      {pendingEmail ? (
        <CodeForm
          email={pendingEmail}
          submitLabel="Confirm account"
          pending={confirm.isPending}
          error={confirm.error ? authErrorMessage(confirm.error) : undefined}
          onSubmit={code => confirm.mutate({ body: { email: pendingEmail, code } })}
        >
          <Group justify="space-between">
            <Link to={signInLocation} state={{ email: pendingEmail } satisfies SignInState}>
              Didn't get a code? Sign in instead
            </Link>
            <Button variant="subtle" onClick={startOver}>
              Use a different email
            </Button>
          </Group>
        </CodeForm>
      ) : (
        <form
          className={classes.form}
          onSubmit={form.onSubmit(({ name, email }) => register.mutate({ body: { name: name.trim(), email: email.trim() } }))}
          noValidate
        >
          <Stack>
            {register.error && (
              <Alert color="red" variant="light">
                {authErrorMessage(register.error)}
                {isAccountExists(register.error) && (
                  <>
                    {" "}
                    <Link to={signInLocation} state={{ email: existingEmail } satisfies SignInState}>
                      Sign in instead
                    </Link>
                  </>
                )}
              </Alert>
            )}
            <TextInput label="Name" autoComplete="name" required {...form.getInputProps("name")} />
            <TextInput label="Email" type="email" autoComplete="email" required {...form.getInputProps("email")} />
            <Button type="submit" loading={register.isPending}>
              Email me a code
            </Button>
          </Stack>
        </form>
      )}

      <Text className={classes.switch}>
        Already a member? <Link to={signInLocation}>Sign in</Link>
      </Text>
    </Container>
  );
};

export default SignUpPage;
