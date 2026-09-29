import { Alert, Button, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { VerifySignInBody } from "@mm/lib/auth";
import type { ReactNode } from "react";

import classes from "./auth.module.css";

type CodeFormProps = {
  email: string;
  submitLabel: string;
  pending: boolean;
  error?: string;
  notice?: string;
  onSubmit: (code: string) => void;
  children?: ReactNode;
};

const CodeForm = ({ email, submitLabel, pending, error, notice, onSubmit, children }: CodeFormProps) => {
  const form = useForm({
    initialValues: { code: "" },
    validate: schemaResolver(VerifySignInBody, { sync: true })
  });

  return (
    <form className={classes.form} onSubmit={form.onSubmit(({ code }) => onSubmit(code.trim()))} noValidate>
      <Stack>
        {error && (
          <Alert color="discount" variant="light">
            {error}
          </Alert>
        )}
        {notice && (
          <Alert color="gilt" variant="light" role="status">
            {notice}
          </Alert>
        )}
        <TextInput
          label="Code"
          description={`We emailed a code to ${email}.`}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          {...form.getInputProps("code")}
        />
        <Button type="submit" color="gilt" loading={pending}>
          {submitLabel}
        </Button>
        {children}
      </Stack>
    </form>
  );
};

export default CodeForm;
