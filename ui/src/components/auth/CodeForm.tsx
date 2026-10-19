import type { MantineColor } from "@mantine/core";
import { Alert, Button, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { VerifySignInBody } from "@mm/lib/auth";
import type { ReactNode } from "react";

import { ui } from "@/copy";

type CodeFormProps = {
  email: string;
  submitLabel: string;
  submitColor?: MantineColor;
  className?: string;
  pending: boolean;
  error?: string;
  notice?: string;
  onSubmit: (code: string) => void;
  children?: ReactNode;
};

const CodeForm = ({
  email,
  submitLabel,
  submitColor,
  className,
  pending,
  error,
  notice,
  onSubmit,
  children
}: CodeFormProps) => {
  const form = useForm({
    initialValues: { code: "" },
    validate: schemaResolver(VerifySignInBody, { sync: true })
  });

  return (
    <form className={className} onSubmit={form.onSubmit(({ code }) => onSubmit(code.trim()))} noValidate>
      <Stack>
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        {notice && (
          <Alert variant="light" role="status">
            {notice}
          </Alert>
        )}
        <TextInput
          label={ui.auth.code}
          description={ui.auth.codeSent(email)}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          {...form.getInputProps("code")}
        />
        <Button type="submit" color={submitColor} loading={pending}>
          {submitLabel}
        </Button>
        {children}
      </Stack>
    </form>
  );
};

export default CodeForm;
