import { Alert, Button, Checkbox, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError } from "@mm/lib/api";
import type { AddressDto } from "@mm/lib/customers";
import { Address, CreateAddressBody, createAddress, customers, Regions, updateAddress } from "@mm/lib/customers";
import { preprocess } from "zod";

import { useEndpointMutation } from "@/api";
import { addressName } from "@/components/account/accountDisplay";
import AppModal from "@/components/AppModal";
import { alerts, ui } from "@/copy";

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const AddressForm = CreateAddressBody.extend({
  label: preprocess(blankToUndefined, Address.shape.label)
});

const saveErrorMessage = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 404 ? alerts.addresses.gone : alerts.addresses.saveFailed;

type AddressFormProps = {
  address?: AddressDto;
  onCancel: () => void;
  onSaved: (address: AddressDto) => void;
};

const AddressFormBody = ({ address, onCancel, onSaved }: AddressFormProps) => {
  const form = useForm({
    initialValues: {
      label: address?.label ?? "",
      recipient: address?.recipient ?? "",
      street: address?.street ?? "",
      city: address?.city ?? "",
      region: address?.region ?? "",
      postalCode: address?.postalCode ?? "",
      setAsDefault: false
    },
    validate: schemaResolver(AddressForm, { sync: true })
  });

  const create = useEndpointMutation(createAddress, { invalidates: [customers], onSuccess: onSaved });
  const update = useEndpointMutation(updateAddress, { invalidates: [customers], onSuccess: onSaved });
  const save = address ? update : create;

  const submit = form.onSubmit(values => {
    const { setAsDefault, ...fields } = AddressForm.parse(values);
    if (address) {
      update.mutate({
        params: { id: address.id },
        body: { ...fields, label: fields.label ?? null, setAsDefault: setAsDefault || undefined }
      });
    } else {
      create.mutate({ body: { ...fields, setAsDefault: setAsDefault || undefined } });
    }
  });

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {save.error && (
          <Alert color="red" variant="light">
            {saveErrorMessage(save.error)}
          </Alert>
        )}
        <TextInput
          label={ui.addresses.label}
          description={ui.addresses.labelHint}
          data-autofocus
          {...form.getInputProps("label")}
        />
        <TextInput label={ui.addresses.recipient} autoComplete="name" required {...form.getInputProps("recipient")} />
        <TextInput
          label={ui.addresses.street}
          autoComplete="address-line1"
          required
          {...form.getInputProps("street")}
        />
        <TextInput label={ui.addresses.city} autoComplete="address-level2" required {...form.getInputProps("city")} />
        <NativeSelect
          label={ui.addresses.region}
          autoComplete="address-level1"
          required
          data={[{ value: "", label: ui.addresses.chooseRegion, disabled: true }, ...Regions]}
          {...form.getInputProps("region")}
        />
        <TextInput
          label={ui.addresses.postalCode}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          required
          {...form.getInputProps("postalCode")}
        />
        {!address?.isDefault && (
          <Checkbox label={ui.addresses.makeDefault} {...form.getInputProps("setAsDefault", { type: "checkbox" })} />
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            {ui.common.cancel}
          </Button>
          <Button type="submit" loading={save.isPending}>
            {ui.addresses.save}
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

type AddressFormModalProps = AddressFormProps & {
  opened: boolean;
};

const AddressFormModal = ({ opened, address, onCancel, onSaved }: AddressFormModalProps) => (
  <AppModal
    opened={opened}
    title={address ? ui.addresses.edit(addressName(address)) : ui.addresses.add}
    onClose={onCancel}
  >
    <AddressFormBody key={address?.id ?? "new"} address={address} onCancel={onCancel} onSaved={onSaved} />
  </AppModal>
);

export default AddressFormModal;
