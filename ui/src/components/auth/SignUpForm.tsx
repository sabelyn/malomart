import { Alert, Button, Stack, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";
import { ApiRequestError, ErrorCode } from "@mm/lib/api";
import type { To } from "react-router";
import { Link } from "react-router";

import { ui } from "@/copy";
import type { SignInState } from "@/routes/paths";
import classes from "./auth.module.css";
import { authErrorMessage } from "./authErrors";

type SignUpValues = { name: string; email: string };

type SignUpFormProps = {
  form: UseFormReturnType<SignUpValues>;
  pending: boolean;
  error: Error | null;
  signInLocation: To;
  onSubmit: (values: SignUpValues) => void;
};

const isAccountExists = (error: unknown) => error instanceof ApiRequestError && error.code === ErrorCode.AccountExists;

const SignUpForm = ({ form, pending, error, signInLocation, onSubmit }: SignUpFormProps) => (
  <form
    className={classes.form}
    onSubmit={form.onSubmit(({ name, email }) => onSubmit({ name: name.trim(), email: email.trim() }))}
    noValidate
  >
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {authErrorMessage(error)}
          {isAccountExists(error) && (
            <>
              {" "}
              <Link to={signInLocation} state={{ email: form.values.email.trim() } satisfies SignInState}>
                {ui.auth.signInInstead}
              </Link>
            </>
          )}
        </Alert>
      )}
      <TextInput label={ui.auth.name} autoComplete="name" required {...form.getInputProps("name")} />
      <TextInput label={ui.auth.email} type="email" autoComplete="email" required {...form.getInputProps("email")} />
      <Button type="submit" loading={pending}>
        {ui.auth.emailMeACode}
      </Button>
    </Stack>
  </form>
);

export default SignUpForm;
