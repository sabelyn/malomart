import type { PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired } from "@mm/lib/customers";
import type { UseQueryResult } from "@tanstack/react-query";
import type { Ref } from "react";
import { useState } from "react";
import { Link } from "react-router";

import { paymentMethodName } from "@/components/account/accountDisplay";
import AddPaymentMethodModal from "@/components/account/AddPaymentMethodModal";
import { malo, statusMessages, ui } from "@/copy";
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
    setStatus(statusMessages.cards.addedToOrder(paymentMethodName(method)));
    setAdding(false);
  };

  const hasExpiredCard = paymentMethods.data?.some(method => isCardExpired(method));

  return (
    <>
      <ChoiceSection
        ref={ref}
        id="checkout-payment"
        title={ui.checkout.payWith}
        groupLabel={ui.checkout.paymentCard}
        choices={toChoices(paymentMethods.data, paymentChoice)}
        isPending={paymentMethods.isPending}
        loadFailedMessage={malo.cards.loadFailed}
        emptyMessage={malo.cards.empty}
        addLabel={ui.cards.add}
        value={value}
        error={error}
        status={status}
        note={
          hasExpiredCard && (
            <>
              {ui.checkout.expiredCardsNote}{" "}
              <Link to={ACCOUNT_PAYMENT_METHODS_PATH}>{ui.checkout.expiredCardsLink}</Link>.
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
