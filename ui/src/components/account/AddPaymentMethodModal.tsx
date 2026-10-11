import { Alert, Button, Checkbox, Group, Radio, Stack, TextInput } from "@mantine/core";
import { schemaResolver, useForm } from "@mantine/form";
import { ApiRequestError } from "@mm/lib/api";
import type { PaymentMethodDto } from "@mm/lib/customers";
import { CardBrand, CardBrands, createPaymentMethod, customers } from "@mm/lib/customers";
import { CreatePaymentMethodBody, tokenizeCard } from "@mm/lib/lambdas";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { boolean, preprocess, strictObject } from "zod";

import { apiCall, routeKey } from "@/api";
import AppModal from "@/components/AppModal";
import ExpirationFields, { expirationFields, expiredIssue, notExpired } from "./ExpirationFields";

const stripSeparators = (value: unknown) => (typeof value === "string" ? value.replace(/[\s-]/g, "") : value);

const AddCardForm = strictObject({
  brand: CardBrand,
  cardNumber: preprocess(stripSeparators, CreatePaymentMethodBody.shape.cardNumber),
  ...expirationFields,
  setAsDefault: boolean()
}).refine(notExpired, expiredIssue);

type SaveCardInput = {
  card: CreatePaymentMethodBody;
  setAsDefault?: true;
};

type VaultedCard = {
  card: string;
  token: string;
};

const saveErrorMessage = (error: unknown) =>
  error instanceof ApiRequestError && error.status === 400
    ? "The vault didn't like that card. Check the details and try again."
    : "Couldn't save that card. Try again.";

type AddPaymentMethodFormProps = {
  onCancel: () => void;
  onSaved: (method: PaymentMethodDto) => void;
};

const AddPaymentMethodForm = ({ onCancel, onSaved }: AddPaymentMethodFormProps) => {
  const queryClient = useQueryClient();
  const vaulted = useRef<VaultedCard>(undefined);

  const form = useForm({
    initialValues: {
      brand: "" as CardBrand | "",
      cardNumber: "",
      expirationMonth: "",
      expirationYear: "",
      setAsDefault: false
    },
    validate: schemaResolver(AddCardForm, { sync: true })
  });

  const save = useMutation({
    mutationFn: async ({ card, setAsDefault }: SaveCardInput) => {
      const cardKey = JSON.stringify(card);
      if (vaulted.current?.card !== cardKey) {
        const { token } = await apiCall(tokenizeCard, { body: card });
        vaulted.current = { card: cardKey, token };
      }
      return apiCall(createPaymentMethod, { body: { token: vaulted.current.token, setAsDefault } });
    },
    onSuccess: async method => {
      await queryClient.invalidateQueries({ queryKey: routeKey(customers) });
      onSaved(method);
    }
  });

  const submit = form.onSubmit(values => {
    const { setAsDefault, ...card } = AddCardForm.parse(values);
    save.mutate({ card, setAsDefault: setAsDefault || undefined });
  });

  return (
    <form onSubmit={submit} noValidate>
      <Stack>
        {save.error && (
          <Alert color="red" variant="light">
            {saveErrorMessage(save.error)}
          </Alert>
        )}
        <Radio.Group label="Card brand" required {...form.getInputProps("brand")}>
          <Group mt="xs">
            {CardBrands.map(brand => (
              <Radio key={brand} value={brand} label={brand} data-autofocus={brand === CardBrands[0] || undefined} />
            ))}
          </Group>
        </Radio.Group>
        <TextInput
          label="Card number"
          description="Goes straight to the vault. I never see it."
          inputMode="numeric"
          autoComplete="cc-number"
          maxLength={19}
          required
          {...form.getInputProps("cardNumber")}
        />
        <ExpirationFields
          monthProps={form.getInputProps("expirationMonth")}
          yearProps={form.getInputProps("expirationYear")}
        />
        <Checkbox
          label="Make this my default payment method"
          {...form.getInputProps("setAsDefault", { type: "checkbox" })}
        />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" loading={save.isPending}>
            Save card
          </Button>
        </Group>
      </Stack>
    </form>
  );
};

type AddPaymentMethodModalProps = AddPaymentMethodFormProps & {
  opened: boolean;
};

const AddPaymentMethodModal = ({ opened, onCancel, onSaved }: AddPaymentMethodModalProps) => (
  <AppModal opened={opened} title="Add a card" onClose={onCancel}>
    <AddPaymentMethodForm onCancel={onCancel} onSaved={onSaved} />
  </AppModal>
);

export default AddPaymentMethodModal;
