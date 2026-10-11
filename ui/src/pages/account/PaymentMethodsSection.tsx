import { Button, Text, Title } from "@mantine/core";
import type { PaymentMethodDto } from "@mm/lib/customers";
import { customers, deletePaymentMethod, listPaymentMethods, updatePaymentMethod } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { endpointQuery, useEndpointMutation } from "@/api";
import { paymentMethodName } from "@/components/account/accountDisplay";
import AddPaymentMethodModal from "@/components/account/AddPaymentMethodModal";
import EditPaymentMethodModal from "@/components/account/EditPaymentMethodModal";
import PaymentMethodCard from "@/components/account/PaymentMethodCard";
import ConfirmModal from "@/components/ConfirmModal";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./account.module.css";

type ModalState<T> = { opened: boolean; target?: T };

const defaultFirst = (a: PaymentMethodDto, b: PaymentMethodDto) => Number(b.isDefault) - Number(a.isDefault);

const PaymentMethodsSection = () => {
  useDocumentTitle("Payment methods");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deletedRef = useRef(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ModalState<PaymentMethodDto>>({ opened: false });
  const [deleting, setDeleting] = useState<ModalState<PaymentMethodDto>>({ opened: false });
  const [focusEditId, setFocusEditId] = useState<string>();
  const [status, setStatus] = useState("");

  const { data: methods, isPending, refetch } = useQuery(endpointQuery(listPaymentMethods, {}));

  const remove = useEndpointMutation(deletePaymentMethod, {
    invalidates: [customers],
    onSuccess: () => {
      deletedRef.current = true;
      setStatus(`Removed ${deleting.target ? paymentMethodName(deleting.target) : "the card"}.`);
      setDeleting(current => ({ ...current, opened: false }));
    }
  });

  const makeDefault = useEndpointMutation(updatePaymentMethod, {
    invalidates: [customers],
    onSuccess: method => {
      setFocusEditId(method.id);
      setStatus(`${paymentMethodName(method)} is now your default payment method.`);
    }
  });

  const openDelete = (method: PaymentMethodDto) => {
    remove.reset();
    setDeleting({ opened: true, target: method });
  };

  const afterDeleteClosed = () => {
    if (deletedRef.current) {
      deletedRef.current = false;
      headingRef.current?.focus();
    }
  };

  const added = (method: PaymentMethodDto) => {
    setStatus(`Added ${paymentMethodName(method)}.`);
    setAdding(false);
  };

  const saved = (method: PaymentMethodDto) => {
    setStatus(`Saved ${paymentMethodName(method)}.`);
    setEditing(current => ({ ...current, opened: false }));
  };

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!methods) {
      return (
        <div role="alert">
          <MaloSays>Couldn't find your cards. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (methods.length === 0) {
      return <MaloSays>No cards on file. I don't do IOUs.</MaloSays>;
    }
    return (
      <ul className={classes.cards}>
        {[...methods].sort(defaultFirst).map(method => (
          <li key={method.id}>
            <PaymentMethodCard
              method={method}
              focusEdit={focusEditId === method.id}
              makingDefault={makeDefault.isPending && makeDefault.variables?.params.id === method.id}
              onEdit={target => setEditing({ opened: true, target })}
              onDelete={openDelete}
              onMakeDefault={({ id }) => makeDefault.mutate({ params: { id }, body: { setAsDefault: true } })}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <section aria-labelledby="payment-methods-heading">
      <div className={classes.sectionHeader}>
        <Title order={2} id="payment-methods-heading" ref={headingRef} tabIndex={-1} className={classes.sectionTitle}>
          Payment methods
        </Title>
        <Button onClick={() => setAdding(true)}>Add a card</Button>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {makeDefault.isError && (
        <Text role="alert" className={classes.error}>
          Couldn't change your default payment method. Try again.
        </Text>
      )}
      {renderContent()}

      <AddPaymentMethodModal opened={adding} onCancel={() => setAdding(false)} onSaved={added} />
      <EditPaymentMethodModal
        opened={editing.opened}
        method={editing.target}
        onCancel={() => setEditing(current => ({ ...current, opened: false }))}
        onSaved={saved}
      />
      <ConfirmModal
        opened={deleting.opened}
        title="Remove this card?"
        confirmLabel="Remove card"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't remove that card. Try again." : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={() => setDeleting(current => ({ ...current, opened: false }))}
        onExitTransitionEnd={afterDeleteClosed}
      >
        {deleting.target && `${paymentMethodName(deleting.target)} will be wiped from the vault.`}
      </ConfirmModal>
    </section>
  );
};

export default PaymentMethodsSection;
