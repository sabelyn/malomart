import { Badge } from "@mantine/core";
import type { AddressDto, PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired } from "@mm/lib/customers";

import { addressLines, addressName, paymentMethodExpiry, paymentMethodName } from "@/components/account/accountDisplay";
import type { Choice } from "./ChoiceSection";

type Saved = { id: string; isDefault: boolean };

export type StepErrors = { address?: string; payment?: string };

const defaultFirst = (a: Saved, b: Saved) => Number(b.isDefault) - Number(a.isDefault);

export const pickChoice = <T extends Saved>(
  saved: T[] | undefined,
  chosenId: string | undefined,
  usable: (item: T) => boolean
) => {
  const chosen = saved?.find(item => item.id === chosenId && usable(item));
  const fallback = saved?.find(item => item.isDefault && usable(item));
  return (chosen ?? fallback)?.id ?? null;
};

export const toChoices = <T extends Saved>(saved: T[] | undefined, toChoice: (item: T) => Choice) =>
  saved && [...saved].sort(defaultFirst).map(toChoice);

const defaultBadge = (isDefault: boolean) => isDefault && <Badge variant="outline">Default</Badge>;

export const addressChoice = (address: AddressDto): Choice => ({
  id: address.id,
  label: (
    <>
      {addressName(address)}
      {defaultBadge(address.isDefault)}
    </>
  ),
  description: addressLines(address).map(line => <span key={line}>{line}</span>)
});

export const paymentChoice = (method: PaymentMethodDto): Choice => ({
  id: method.id,
  label: (
    <>
      {paymentMethodName(method)}
      {defaultBadge(method.isDefault)}
    </>
  ),
  description: paymentMethodExpiry(method),
  disabled: isCardExpired(method)
});

export const stepErrors = (
  addressId: string | null,
  addresses: AddressDto[] | undefined,
  paymentMethodId: string | null,
  paymentMethods: PaymentMethodDto[] | undefined
): StepErrors => ({
  address: addressId
    ? undefined
    : addresses?.length
      ? "Choose where this is going."
      : "Add an address first. I need somewhere to send it.",
  payment: paymentMethodId
    ? undefined
    : paymentMethods?.some(method => !isCardExpired(method))
      ? "Choose a card to pay with."
      : "Add a card first. No rupees, no goods."
});
