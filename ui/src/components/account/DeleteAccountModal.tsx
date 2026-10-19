import { Alert, Button, Group, Stack, Text } from "@mantine/core";
import type { SignInMethod } from "@mm/lib/auth";
import { confirmAccountDeletion, requestAccountDeletion, startGoogleAccountDeletion } from "@mm/lib/auth";
import { useState } from "react";

import { isUnauthorized, useEndpointMutation } from "@/api";
import AppModal from "@/components/AppModal";
import { authErrorMessage, SESSION_TIMED_OUT } from "@/components/auth/authErrors";
import CodeForm from "@/components/auth/CodeForm";

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
        setNotice(SESSION_TIMED_OUT);
      }
    }
  });

  const resend = () => {
    confirm.reset();
    request.mutate({}, { onSuccess: () => setNotice("New code sent.") });
  };

  if (codeSent) {
    return (
      <CodeForm
        email={email}
        submitLabel="Delete my account"
        submitColor="red"
        pending={confirm.isPending}
        error={confirm.error && !isUnauthorized(confirm.error) ? authErrorMessage(confirm.error) : undefined}
        notice={notice}
        onSubmit={code => confirm.mutate({ body: { code } })}
      >
        <Group justify="space-between">
          <Button variant="subtle" onClick={resend} loading={request.isPending}>
            Send a new code
          </Button>
          <Button variant="subtle" onClick={onCancel}>
            Keep my account
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
      <Text>
        This deletes your account, saved addresses, and payment methods. There's no undo. We'll email a code to {email}{" "}
        to make sure it's really you.
      </Text>
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onCancel} data-autofocus>
          Keep my account
        </Button>
        <Button
          color="red"
          loading={request.isPending}
          onClick={() => {
            setNotice(undefined);
            request.mutate({});
          }}
        >
          Email me a code
        </Button>
      </Group>
    </Stack>
  );
};

const GoogleDeleteAccountFlow = ({ onCancel }: { onCancel: () => void }) => (
  <Stack>
    <Text>
      This deletes your account, saved addresses, and payment methods. There's no undo. We'll send you to Google to make
      sure it's really you, and your account is deleted as soon as you're back.
    </Text>
    <Group justify="flex-end">
      <Button variant="subtle" onClick={onCancel} data-autofocus>
        Keep my account
      </Button>
      <Button component="a" href={startGoogleAccountDeletion.fullPath} color="red">
        Confirm with Google
      </Button>
    </Group>
  </Stack>
);

type DeleteAccountModalProps = DeleteAccountFlowProps & {
  opened: boolean;
  signInMethod: SignInMethod;
};

const DeleteAccountModal = ({ opened, email, signInMethod, onCancel, onDeleted }: DeleteAccountModalProps) => (
  <AppModal opened={opened} title="Delete your account?" onClose={onCancel}>
    {signInMethod === "google" ? (
      <GoogleDeleteAccountFlow onCancel={onCancel} />
    ) : (
      <DeleteAccountFlow email={email} onCancel={onCancel} onDeleted={onDeleted} />
    )}
  </AppModal>
);

export default DeleteAccountModal;
