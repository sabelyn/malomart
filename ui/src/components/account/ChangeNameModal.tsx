import { Alert, Button, Group, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import type { CurrentUser } from "@mm/lib/auth";
import { UpdateProfileBody, updateProfile } from "@mm/lib/auth";

import { useEndpointMutation, useSetSession } from "@/api";
import AppModal from "@/components/AppModal";

type ChangeNameFormProps = {
  name: string;
  onCancel: () => void;
  onSaved: (user: CurrentUser) => void;
};

const ChangeNameForm = ({ name, onCancel, onSaved }: ChangeNameFormProps) => {
  const setSession = useSetSession();
  const form = useForm({
    initialValues: { name },
    validate: schemaResolver(UpdateProfileBody, { sync: true })
  });

  const save = useEndpointMutation(updateProfile, {
    onSuccess: user => {
      setSession(user);
      onSaved(user);
    }
  });

  return (
    <form onSubmit={form.onSubmit(values => save.mutate({ body: UpdateProfileBody.parse(values) }))} noValidate>
      <Stack>
        {save.error && (
          <Alert color="red" variant="light">
            Couldn't change your name. Try again.
          </Alert>
        )}
        <TextInput label="Name" autoComplete="name" required data-autofocus {...form.getInputProps("name")} />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save name
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

type ChangeNameModalProps = ChangeNameFormProps & {
  opened: boolean;
};

const ChangeNameModal = ({ opened, name, onCancel, onSaved }: ChangeNameModalProps) => (
  <AppModal opened={opened} title="Change your name" onClose={onCancel}>
    <ChangeNameForm name={name} onCancel={onCancel} onSaved={onSaved} />
  </AppModal>
);

export default ChangeNameModal;
