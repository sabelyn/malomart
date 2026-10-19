import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import type { SignInMethod } from "@mm/lib/auth";
import { confirmAccountDeletion, requestAccountDeletion, startGoogleAccountDeletion } from "@mm/lib/auth";
import { useState } from "react";

import { isUnauthorized, useEndpointMutation } from "@/api";
import AppModal from "@/components/AppModal";
import { authErrorMessage } from "@/components/auth/authErrors";
import CodeForm from "@/components/auth/CodeForm";
import { alerts, ui } from "@/copy";

type DeleteAccountFlowProps = {
  email: string;
  onCancel: () => void;
  onDeleted: () => void;
};

const DeleteAccountFlow = ({ email, onCancel, onDeleted }: DeleteAccountFlowProps) => {
  const [codeSent, setCodeSent] = useState(false);
  const [notice, setNotice] = useState<string>();

  const request = useEndpointMutation(requestAccountDeletion, {
    onSuccess: () => setCodeSent(true)
  });

  const confirm = useEndpointMutation(confirmAccountDeletion, {
    onSuccess: onDeleted,
    onError: error => {
      if (isUnauthorized(error)) {
        setCodeSent(false);
        setNotice(alerts.auth.sessionTimedOut);
      }
    }
  });

  const resend = () => {
    confirm.reset();
    request.mutate({}, { onSuccess: () => setNotice(alerts.auth.newCodeSent) });
  };

  if (codeSent) {
    return (
      <CodeForm
        email={email}
        submitLabel={ui.profile.deleteMyAccount}
        submitColor="red"
        pending={confirm.isPending}
        error={confirm.error && !isUnauthorized(confirm.error) ? authErrorMessage(confirm.error) : undefined}
        notice={notice}
        onSubmit={code => confirm.mutate({ body: { code } })}
      >
        <Group justify="space-between">
          <Button variant="subtle" onClick={resend} loading={request.isPending}>
            {ui.auth.sendNewCode}
          </Button>
          <Button variant="subtle" onClick={onCancel}>
            {ui.profile.keepMyAccount}
          </Button>
        </Group>
      </CodeForm>
    );
  }

  return (
    <Stack>
      {request.error && (
        <Alert color="red" variant="light">
          {authErrorMessage(request.error)}
        </Alert>
      )}
      {notice && (
        <Alert variant="light" role="status">
          {notice}
        </Alert>
      )}
      <Text>{ui.profile.deleteWarning(email)}</Text>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel} data-autofocus>
          {ui.profile.keepMyAccount}
        </Button>
        <Button
          color="red"
          loading={request.isPending}
          onClick={() => {
            setNotice(undefined);
            request.mutate({});
          }}
        >
          {ui.auth.emailMeACode}
        </Button>
      </Group>
    </Stack>
  );
};

const GoogleDeleteAccountFlow = ({ onCancel }: { onCancel: () => void }) => (
  <Stack>
    <Text>{ui.profile.googleDeleteWarning}</Text>
    <Group justify="flex-end">
      <Button variant="subtle" onClick={onCancel} data-autofocus>
        {ui.profile.keepMyAccount}
      </Button>
      <Button component="a" href={startGoogleAccountDeletion.fullPath} color="red">
        {ui.profile.confirmWithGoogle}
      </Button>
    </Group>
  </Stack>
);

type DeleteAccountModalProps = DeleteAccountFlowProps & {
  opened: boolean;
  signInMethod: SignInMethod;
};

const DeleteAccountModal = ({ opened, email, signInMethod, onCancel, onDeleted }: DeleteAccountModalProps) => (
  <AppModal opened={opened} title={ui.profile.deleteTitle} onClose={onCancel}>
    {signInMethod === "google" ? (
      <GoogleDeleteAccountFlow onCancel={onCancel} />
    ) : (
      <DeleteAccountFlow email={email} onCancel={onCancel} onDeleted={onDeleted} />
    )}
  </AppModal>
);

export default DeleteAccountModal;
