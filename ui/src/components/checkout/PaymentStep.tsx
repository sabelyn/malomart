import type { PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired } from "@mm/lib/customers";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Ref } from "react";
import { useState } from "react";
import { Link } from "react-router";

import { paymentMethodName } from "@/components/account/accountDisplay";
import AddPaymentMethodModal from "@/components/account/AddPaymentMethodModal";
import { ACCOUNT_PAYMENT_METHODS_PATH } from "@/routes/paths";
import { paymentChoice, toChoices } from "./checkoutChoices";
import ChoiceSection from "./ChoiceSection";

type PaymentStepProps = {
  ref?: Ref<HTMLElement>;
  paymentMethods: UseQueryResult<PaymentMethodDto[]>;
  value: string | null;
  error?: string;
  onChange: (id: string) => void;
};

const PaymentStep = ({ ref, paymentMethods, value, error, onChange }: PaymentStepProps) => {
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState("");

  const added = (method: PaymentMethodDto) => {
    onChange(method.id);
    setStatus(`Added ${paymentMethodName(method)} and picked it for this order.`);
    setAdding(false);
  };

  const hasExpiredCard = paymentMethods.data?.some(method => isCardExpired(method));

  return (
    <>
      <ChoiceSection
        ref={ref}
        id="checkout-payment"
        title="Pay with"
        groupLabel="Payment card"
        choices={toChoices(paymentMethods.data, paymentChoice)}
        isPending={paymentMethods.isPending}
        loadFailedMessage="Couldn't find your cards. Not my fault."
        emptyMessage="No cards on file. I don't do IOUs."
        addLabel="Add a card"
        value={value}
        error={error}
        status={status}
        note={
          hasExpiredCard && (
            <>
              Expired cards can't be used. <Link to={ACCOUNT_PAYMENT_METHODS_PATH}>Update them in your account</Link>.
            </>
          )
        }
        onRetry={() => void paymentMethods.refetch()}
        onAdd={() => setAdding(true)}
        onChange={onChange}
      />
      <AddPaymentMethodModal opened={adding} onCancel={() => setAdding(false)} onSaved={added} />
    </>
  );
};

export default PaymentStep;
