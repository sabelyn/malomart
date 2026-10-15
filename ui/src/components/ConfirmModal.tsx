import { Alert, Button, Group, Stack } from "@mantine/core";
import type { ReactNode } from "react";

import AppModal from "@/components/AppModal";

type ConfirmModalProps = {
  opened: boolean;
  title: string;
  confirmLabel: string;
  dismissLabel?: string;
  pending: boolean;
  error?: string;
  children: ReactNode;
  onConfirm: () => void;
  onClose: () => void;
  onExitTransitionEnd?: () => void;
};

const ConfirmModal = ({
  opened,
  title,
  confirmLabel,
  dismissLabel = "Cancel",
  pending,
  error,
  children,
  onConfirm,
  onClose,
  onExitTransitionEnd
}: ConfirmModalProps) => (
  <AppModal
    opened={opened}
    title={title}
    description={children}
    onClose={onClose}
    onExitTransitionEnd={onExitTransitionEnd}
  >
    <Stack>
      {error && (
        <Alert color="red" variant="light">
          {error}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button variant="subtle" onClick={onClose} data-autofocus>
          {dismissLabel}
        </Button>
        <Button color="red" loading={pending} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Stack>
  </AppModal>
);

export default ConfirmModal;
