import { Button, Text } from "@mantine/core";
import type { AddressDto } from "@mm/lib/customers";
import { customers, deleteAddress, listAddresses, updateAddress } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { endpointQuery, useEndpointMutation } from "@/api";
import classes from "@/components/account/account.module.css";
import { addressName } from "@/components/account/accountDisplay";
import AddressFormModal from "@/components/account/AddressFormModal";
import AddressList from "@/components/account/AddressList";
import ConfirmModal from "@/components/ConfirmModal";
import SectionHeader from "@/components/layout/SectionHeader";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { alerts, malo, statusMessages, ui } from "@/copy";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

type EditState = { opened: boolean; target?: AddressDto };

const AddressesSection = () => {
  useDocumentTitle(ui.pageTitles.addresses);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleting = useConfirmDialog<AddressDto>(headingRef);
  const [editing, setEditing] = useState<EditState>({ opened: false });
  const [focusEditId, setFocusEditId] = useState<string>();
  const [status, setStatus] = useState("");

  const { data: addresses, isPending, refetch } = useQuery(endpointQuery(listAddresses, {}));

  const remove = useEndpointMutation(deleteAddress, {
    invalidates: [customers],
    onSuccess: () => {
      setStatus(statusMessages.addresses.deleted(deleting.target && addressName(deleting.target)));
      deleting.complete();
    }
  });

  const makeDefault = useEndpointMutation(updateAddress, {
    invalidates: [customers],
    onSuccess: address => {
      setFocusEditId(address.id);
      setStatus(statusMessages.addresses.madeDefault(addressName(address)));
    }
  });

  const openDelete = (address: AddressDto) => {
    remove.reset();
    deleting.open(address);
  };

  const saved = (address: AddressDto) => {
    setStatus(statusMessages.addresses.saved(addressName(address)));
    setEditing(current => ({ ...current, opened: false }));
  };

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!addresses) {
      return (
        <RetryAlert onRetry={() => void refetch()}>
          <MaloSays>{malo.addresses.loadFailed}</MaloSays>
        </RetryAlert>
      );
    }
    if (addresses.length === 0) {
      return <MaloSays>{malo.addresses.empty}</MaloSays>;
    }
    return (
      <AddressList
        addresses={addresses}
        focusEditId={focusEditId}
        makingDefaultId={makeDefault.isPending ? makeDefault.variables.params.id : undefined}
        onEdit={target => setEditing({ opened: true, target })}
        onDelete={openDelete}
        onMakeDefault={({ id }) => makeDefault.mutate({ params: { id }, body: { setAsDefault: true } })}
      />
    );
  };

  return (
    <section aria-labelledby="addresses-heading">
      <SectionHeader id="addresses-heading" title={ui.addresses.heading} headingRef={headingRef}>
        <Button onClick={() => setEditing({ opened: true })}>{ui.addresses.add}</Button>
      </SectionHeader>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {makeDefault.isError && (
        <Text role="alert" className={classes.error}>
          {alerts.addresses.makeDefaultFailed}
        </Text>
      )}
      {renderContent()}

      <AddressFormModal
        opened={editing.opened}
        address={editing.target}
        onCancel={() => setEditing(current => ({ ...current, opened: false }))}
        onSaved={saved}
      />
      <ConfirmModal
        opened={deleting.opened}
        title={ui.addresses.deleteTitle}
        confirmLabel={ui.addresses.deleteConfirm}
        pending={remove.isPending}
        error={remove.isError ? alerts.addresses.deleteFailed : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={deleting.close}
        onExitTransitionEnd={deleting.afterClose}
      >
        {deleting.target && ui.addresses.deleteWarning(addressName(deleting.target))}
      </ConfirmModal>
    </section>
  );
};

export default AddressesSection;
