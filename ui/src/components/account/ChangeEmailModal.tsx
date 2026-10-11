import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import type { CurrentUser } from "@mm/lib/auth";
import { confirmEmailChange, RequestEmailChangeBody, requestEmailChange } from "@mm/lib/auth";
import { useState } from "react";

import { useEndpointMutation, useSetSession } from "@/api";
import AppModal from "@/components/AppModal";
import { authErrorMessage } from "@/components/auth/authErrors";
import CodeForm from "@/components/auth/CodeForm";

type ChangeEmailFlowProps = {
  currentEmail: string;
  onCancel: () => void;
  onSaved: (user: CurrentUser) => void;
};

const ChangeEmailFlow = ({ currentEmail, onCancel, onSaved }: ChangeEmailFlowProps) => {
  const setSession = useSetSession();
  const [pendingEmail, setPendingEmail] = useState<string>();
  const [notice, setNotice] = useState<string>();

  const EmailForm = RequestEmailChangeBody.refine(
    ({ email }) => email.toLowerCase() !== currentEmail.toLowerCase(),
    { error: "That's already your email.", path: ["email"] }
  );

  const form = useForm({
    initialValues: { email: "" },
    validate: schemaResolver(EmailForm, { sync: true })
  });

  const request = useEndpointMutation(requestEmailChange, {
    onSuccess: (_, { body }) => setPendingEmail(body.email)
  });

  const confirm = useEndpointMutation(confirmEmailChange, {
    onSuccess: user => {
      setSession(user);
      onSaved(user);
    }
  });

  const resend = (email: string) => {
    confirm.reset();
    request.mutate({ body: { email } }, { onSuccess: () => setNotice("New code sent.") });
  };

  const startOver = () => {
    setPendingEmail(undefined);
    setNotice(undefined);
    request.reset();
    confirm.reset();
  };

  if (pendingEmail) {
    return (
      <CodeForm
        email={pendingEmail}
        submitLabel="Confirm new email"
        pending={confirm.isPending}
        error={confirm.error ? authErrorMessage(confirm.error) : undefined}
        notice={notice}
        onSubmit={code => confirm.mutate({ body: { code } })}
      >
        <Group justify="space-between">
          <Button variant="subtle" onClick={() => resend(pendingEmail)} loading={request.isPending}>
            Send a new code
          </Button>
          <Button variant="subtle" onClick={startOver}>
            Use a different email
          </Button>
        </Group>
      </CodeForm>
    );
  }

  return (
    <form onSubmit={form.onSubmit(({ email }) => request.mutate({ body: { email: email.trim() } }))} noValidate>
      <Stack>
        {request.error && (
          <Alert color="red" variant="light">
            {authErrorMessage(request.error)}
          </Alert>
        )}
        <TextInput
          label="New email"
          description={`Your current email, ${currentEmail}, keeps working until you confirm the new one.`}
          type="email"
          autoComplete="email"
          required
          data-autofocus
          {...form.getInputProps("email")}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={request.isPending}>
            Email me a code
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

type ChangeEmailModalProps = ChangeEmailFlowProps & {
  opened: boolean;
};

const ChangeEmailModal = ({ opened, currentEmail, onCancel, onSaved }: ChangeEmailModalProps) => (
  <AppModal opened={opened} title="Change your email" onClose={onCancel}>
    <ChangeEmailFlow currentEmail={currentEmail} onCancel={onCancel} onSaved={onSaved} />
  </AppModal>
);

export default ChangeEmailModal;
