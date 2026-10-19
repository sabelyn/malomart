import { Button, Text } from "@mantine/core";
import type { PaymentMethodDto } from "@mm/lib/customers";
import { customers, deletePaymentMethod, listPaymentMethods, updatePaymentMethod } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { endpointQuery, useEndpointMutation } from "@/api";
import classes from "@/components/account/account.module.css";
import { paymentMethodName } from "@/components/account/accountDisplay";
import AddPaymentMethodModal from "@/components/account/AddPaymentMethodModal";
import EditPaymentMethodModal from "@/components/account/EditPaymentMethodModal";
import PaymentMethodList from "@/components/account/PaymentMethodList";
import ConfirmModal from "@/components/ConfirmModal";
import SectionHeader from "@/components/layout/SectionHeader";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { alerts, malo, statusMessages, ui } from "@/copy";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type EditState = { opened: boolean; target?: PaymentMethodDto };

const PaymentMethodsSection = () => {
  useDocumentTitle(ui.pageTitles.cards);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleting = useConfirmDialog<PaymentMethodDto>(headingRef);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<EditState>({ opened: false });
  const [focusEditId, setFocusEditId] = useState<string>();
  const [status, setStatus] = useState("");

  const { data: methods, isPending, refetch } = useQuery(endpointQuery(listPaymentMethods, {}));

  const remove = useEndpointMutation(deletePaymentMethod, {
    invalidates: [customers],
    onSuccess: () => {
      setStatus(statusMessages.cards.removed(deleting.target && paymentMethodName(deleting.target)));
      deleting.complete();
    }
  });

  const makeDefault = useEndpointMutation(updatePaymentMethod, {
    invalidates: [customers],
    onSuccess: method => {
      setFocusEditId(method.id);
      setStatus(statusMessages.cards.madeDefault(paymentMethodName(method)));
    }
  });

  const openDelete = (method: PaymentMethodDto) => {
    remove.reset();
    deleting.open(method);
  };

  const added = (method: PaymentMethodDto) => {
    setStatus(statusMessages.cards.added(paymentMethodName(method)));
    setAdding(false);
  };

  const saved = (method: PaymentMethodDto) => {
    setStatus(statusMessages.cards.saved(paymentMethodName(method)));
    setEditing(current => ({ ...current, opened: false }));
  };

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!methods) {
      return (
        <RetryAlert onRetry={() => void refetch()}>
          <MaloSays>{malo.cards.loadFailed}</MaloSays>
        </RetryAlert>
      );
    }
    if (methods.length === 0) {
      return <MaloSays>{malo.cards.empty}</MaloSays>;
    }
    return (
      <PaymentMethodList
        methods={methods}
        focusEditId={focusEditId}
        makingDefaultId={makeDefault.isPending ? makeDefault.variables.params.id : undefined}
        onEdit={target => setEditing({ opened: true, target })}
        onDelete={openDelete}
        onMakeDefault={({ id }) => makeDefault.mutate({ params: { id }, body: { setAsDefault: true } })}
      />
    );
  };

  return (
    <section aria-labelledby="payment-methods-heading">
      <SectionHeader id="payment-methods-heading" title={ui.cards.heading} headingRef={headingRef}>
        <Button onClick={() => setAdding(true)}>{ui.cards.add}</Button>
      </SectionHeader>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {makeDefault.isError && (
        <Text role="alert" className={classes.error}>
          {alerts.cards.makeDefaultFailed}
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
        title={ui.cards.removeTitle}
        confirmLabel={ui.cards.removeConfirm}
        pending={remove.isPending}
        error={remove.isError ? alerts.cards.removeFailed : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={deleting.close}
        onExitTransitionEnd={deleting.afterClose}
      >
        {deleting.target && ui.cards.removeWarning(paymentMethodName(deleting.target))}
      </ConfirmModal>
    </section>
  );
};

export default PaymentMethodsSection;
