import type { AddressDto } from "@mm/lib/customers";

import classes from "./account.module.css";
import AddressCard from "./AddressCard";

type AddressListProps = {
  addresses: AddressDto[];
  focusEditId?: string;
  makingDefaultId?: string;
  onEdit: (address: AddressDto) => void;
  onDelete: (address: AddressDto) => void;
  onMakeDefault: (address: AddressDto) => void;
};

const defaultFirst = (a: AddressDto, b: AddressDto) => Number(b.isDefault) - Number(a.isDefault);

const AddressList = ({
  addresses,
  focusEditId,
  makingDefaultId,
  onEdit,
  onDelete,
  onMakeDefault
}: AddressListProps) => (
  <ul className={classes.cards}>
    {[...addresses].sort(defaultFirst).map(address => (
      <li key={address.id}>
        <AddressCard
          address={address}
          focusEdit={focusEditId === address.id}
          makingDefault={makingDefaultId === address.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onMakeDefault={onMakeDefault}
        />
      </li>
    ))}
  </ul>
);

export default AddressList;
