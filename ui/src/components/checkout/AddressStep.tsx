import type { AddressDto } from "@mm/lib/customers";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Ref } from "react";
import { useState } from "react";

import { addressName } from "@/components/account/accountDisplay";
import AddressFormModal from "@/components/account/AddressFormModal";
import { malo, statusMessages, ui } from "@/copy";
import { addressChoice, toChoices } from "./checkoutChoices";
import ChoiceSection from "./ChoiceSection";

type AddressStepProps = {
  ref?: Ref<HTMLElement>;
  addresses: UseQueryResult<AddressDto[]>;
  value: string | null;
  error?: string;
  onChange: (id: string) => void;
};

const AddressStep = ({ ref, addresses, value, error, onChange }: AddressStepProps) => {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  const added = (address: AddressDto) => {
    onChange(address.id);
    setStatus(statusMessages.addresses.addedToOrder(addressName(address)));
    setAdding(false);
  };

  return (
    <>
      <ChoiceSection
        ref={ref}
        id="checkout-address"
        title={ui.checkout.shipTo}
        groupLabel={ui.checkout.shippingAddress}
        choices={toChoices(addresses.data, addressChoice)}
        isPending={addresses.isPending}
        loadFailedMessage={malo.addresses.loadFailed}
        emptyMessage={malo.addresses.empty}
        addLabel={ui.addresses.add}
        value={value}
        error={error}
        status={status}
        onRetry={() => void addresses.refetch()}
        onAdd={() => setAdding(true)}
        onChange={onChange}
      />
      <AddressFormModal opened={adding} onCancel={() => setAdding(false)} onSaved={added} />
    </>
  );
};

export default AddressStep;
