import { Alert, Button, Checkbox, Group, NativeSelect, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError } from "@mm/lib/api";
import type { AddressDto } from "@mm/lib/customers";
import { Address, CreateAddressBody, createAddress, customers, Regions, updateAddress } from "@mm/lib/customers";
import { preprocess } from "zod";

import { useEndpointMutation } from "@/api";
import { addressName } from "@/components/account/accountDisplay";
import AppModal from "@/components/AppModal";

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const AddressForm = CreateAddressBody.extend({
  label: preprocess(blankToUndefined, Address.shape.label)
});

const saveErrorMessage = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 404
    ? "That address is gone. Someone deleted it."
    : "Couldn't save that address. Try again.";

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
          label="Label"
          description="Optional. Something like Home or Link's hideout."
          data-autofocus
          {...form.getInputProps("label")}
        />
        <TextInput label="Recipient" autoComplete="name" required {...form.getInputProps("recipient")} />
        <TextInput label="Street" autoComplete="address-line1" required {...form.getInputProps("street")} />
        <TextInput label="City" autoComplete="address-level2" required {...form.getInputProps("city")} />
        <NativeSelect
          label="Region"
          autoComplete="address-level1"
          required
          data={[{ value: "", label: "Choose a region", disabled: true }, ...Regions]}
          {...form.getInputProps("region")}
        />
        <TextInput
          label="Postal code"
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={5}
          required
          {...form.getInputProps("postalCode")}
        />
        {!address?.isDefault && (
          <Checkbox
            label="Make this my default address"
            {...form.getInputProps("setAsDefault", { type: "checkbox" })}
          />
        )}
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save address
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
  <AppModal opened={opened} title={address ? `Edit ${addressName(address)}` : "Add an address"} onClose={onCancel}>
    <AddressFormBody key={address?.id ?? "new"} address={address} onCancel={onCancel} onSaved={onSaved} />
  </AppModal>
);

export default AddressFormModal;
