import { Button, Text, Title } from "@mantine/core";
import type { AddressDto } from "@mm/lib/customers";
import { customers, deleteAddress, listAddresses, updateAddress } from "@mm/lib/customers";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { endpointQuery, useEndpointMutation } from "@/api";
import { addressName } from "@/components/account/accountDisplay";
import AddressCard from "@/components/account/AddressCard";
import AddressFormModal from "@/components/account/AddressFormModal";
import ConfirmModal from "@/components/ConfirmModal";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./account.module.css";

type ModalState<T> = { opened: boolean; target?: T };

const defaultFirst = (a: AddressDto, b: AddressDto) => Number(b.isDefault) - Number(a.isDefault);

const AddressesSection = () => {
  useDocumentTitle("Addresses");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deletedRef = useRef(false);
  const [editing, setEditing] = useState<ModalState<AddressDto>>({ opened: false });
  const [deleting, setDeleting] = useState<ModalState<AddressDto>>({ opened: false });
  const [focusEditId, setFocusEditId] = useState<string>();
  const [status, setStatus] = useState("");

  const { data: addresses, isPending, refetch } = useQuery(endpointQuery(listAddresses, {}));

  const remove = useEndpointMutation(deleteAddress, {
    invalidates: [customers],
    onSuccess: () => {
      deletedRef.current = true;
      setStatus(`Deleted ${deleting.target ? addressName(deleting.target) : "the address"}.`);
      setDeleting(current => ({ ...current, opened: false }));
    }
  });

  const makeDefault = useEndpointMutation(updateAddress, {
    invalidates: [customers],
    onSuccess: address => {
      setFocusEditId(address.id);
      setStatus(`${addressName(address)} is now your default address.`);
    }
  });

  const openDelete = (address: AddressDto) => {
    remove.reset();
    setDeleting({ opened: true, target: address });
  };

  const afterDeleteClosed = () => {
    if (deletedRef.current) {
      deletedRef.current = false;
      headingRef.current?.focus();
    }
  };

  const saved = (address: AddressDto) => {
    setStatus(`Saved ${addressName(address)}.`);
    setEditing(current => ({ ...current, opened: false }));
  };

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!addresses) {
      return (
        <div role="alert">
          <MaloSays>Couldn't find your addresses. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (addresses.length === 0) {
      return <MaloSays>No addresses yet. Can't deliver to nowhere.</MaloSays>;
    }
    return (
      <ul className={classes.cards}>
        {[...addresses].sort(defaultFirst).map(address => (
          <li key={address.id}>
            <AddressCard
              address={address}
              focusEdit={focusEditId === address.id}
              makingDefault={makeDefault.isPending && makeDefault.variables?.params.id === address.id}
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
    <section aria-labelledby="addresses-heading">
      <div className={classes.sectionHeader}>
        <Title order={2} id="addresses-heading" ref={headingRef} tabIndex={-1} className={classes.sectionTitle}>
          Addresses
        </Title>
        <Button onClick={() => setEditing({ opened: true })}>Add an address</Button>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      {makeDefault.isError && (
        <Text role="alert" className={classes.error}>
          Couldn't change your default address. Try again.
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
        title="Delete this address?"
        confirmLabel="Delete address"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't delete that address. Try again." : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={() => setDeleting(current => ({ ...current, opened: false }))}
        onExitTransitionEnd={afterDeleteClosed}
      >
        {deleting.target && `${addressName(deleting.target)} will be gone for good.`}
      </ConfirmModal>
    </section>
  );
};

export default AddressesSection;
