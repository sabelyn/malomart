import { Alert, Button, Checkbox, Group, Stack, Text } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError } from "@mm/lib/api";
import type { PaymentMethodDto } from "@mm/lib/customers";
import { customers, updatePaymentMethod } from "@mm/lib/customers";
import { boolean, strictObject } from "zod";

import { useEndpointMutation } from "@/api";
import { paymentMethodName } from "@/components/account/accountDisplay";
import AppModal from "@/components/AppModal";
import ExpirationFields, { expirationFields, expiredIssue, notExpired } from "./ExpirationFields";

const EditCardForm = strictObject({
  ...expirationFields,
  setAsDefault: boolean()
}).refine(notExpired, expiredIssue);

const saveErrorMessage = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 404
    ? "That card is gone. Someone deleted it."
    : "Couldn't save that card. Try again.";

type EditPaymentMethodFormProps = {
  method: PaymentMethodDto;
  onCancel: () => void;
  onSaved: (method: PaymentMethodDto) => void;
};

const EditPaymentMethodForm = ({ method, onCancel, onSaved }: EditPaymentMethodFormProps) => {
  const form = useForm({
    initialValues: {
      expirationMonth: String(method.expirationMonth),
      expirationYear: String(method.expirationYear),
      setAsDefault: false
    },
    validate: schemaResolver(EditCardForm, { sync: true })
  });

  const update = useEndpointMutation(updatePaymentMethod, { invalidates: [customers], onSuccess: onSaved });

  const submit = form.onSubmit(values => {
    const { setAsDefault, ...expiration } = EditCardForm.parse(values);
    const expirationChanged =
      expiration.expirationMonth !== method.expirationMonth || expiration.expirationYear !== method.expirationYear;
    if (!expirationChanged && !setAsDefault) {
      onCancel();
      return;
    }
    update.mutate({
      params: { id: method.id },
      body: {
        expiration: expirationChanged ? expiration : undefined,
        setAsDefault: setAsDefault || undefined
      }
    });
  });

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {update.error && (
          <Alert color="red" variant="light">
            {saveErrorMessage(update.error)}
          </Alert>
        )}
        <Text>Got a replacement card with the same number? Update the expiration here.</Text>
        <ExpirationFields
          autoFocus
          currentYear={method.expirationYear}
          monthProps={form.getInputProps("expirationMonth")}
          yearProps={form.getInputProps("expirationYear")}
        />
        {!method.isDefault && (
          <Checkbox
            label="Make this my default payment method"
            {...form.getInputProps("setAsDefault", { type: "checkbox" })}
          />
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={update.isPending}>
            Save card
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

type EditPaymentMethodModalProps = Omit<EditPaymentMethodFormProps, "method"> & {
  opened: boolean;
  method?: PaymentMethodDto;
};

const EditPaymentMethodModal = ({ opened, method, onCancel, onSaved }: EditPaymentMethodModalProps) => (
  <AppModal opened={opened} title={method ? `Edit ${paymentMethodName(method)}` : "Edit card"} onClose={onCancel}>
    {method && <EditPaymentMethodForm key={method.id} method={method} onCancel={onCancel} onSaved={onSaved} />}
  </AppModal>
);

export default EditPaymentMethodModal;
