import { Alert, Button, Stack, TextInput } from "@mantine/core";
import type { UseFormReturnType } from "@mantine/form";

import { ui } from "@/copy";
import classes from "./auth.module.css";
import { authErrorMessage } from "./authErrors";

type SignInEmailFormProps = {
  form: UseFormReturnType<{ email: string }>;
  pending: boolean;
  error: Error | null;
  notice?: string;
  onSubmit: (email: string) => void;
};

const SignInEmailForm = ({ form, pending, error, notice, onSubmit }: SignInEmailFormProps) => (
  <form className={classes.form} onSubmit={form.onSubmit(({ email }) => onSubmit(email.trim()))} noValidate>
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {authErrorMessage(error)}
        </Alert>
      )}
      {notice && (
        <Alert variant="light" role="status">
          {notice}
        </Alert>
      )}
      <TextInput label={ui.auth.email} type="email" autoComplete="email" required {...form.getInputProps("email")} />
      <Button type="submit" loading={pending}>
        {ui.auth.emailMeACode}
      </Button>
    </Stack>
  </form>
);

export default SignInEmailForm;
