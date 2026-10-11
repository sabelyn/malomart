import type { AddressDto } from "@mm/lib/customers";

import { addressLines, addressName } from "@/components/account/accountDisplay";
import AccountCard from "./AccountCard";
import classes from "./AccountCard.module.css";

type AddressCardProps = {
  address: AddressDto;
  focusEdit: boolean;
  makingDefault: boolean;
  onEdit: (address: AddressDto) => void;
  onDelete: (address: AddressDto) => void;
  onMakeDefault: (address: AddressDto) => void;
};

const AddressCard = ({ address, focusEdit, makingDefault, onEdit, onDelete, onMakeDefault }: AddressCardProps) => (
  <AccountCard
    id={address.id}
    title={addressName(address)}
    isDefault={address.isDefault}
    focusEdit={focusEdit}
    makingDefault={makingDefault}
    onEdit={() => onEdit(address)}
    onDelete={() => onDelete(address)}
    onMakeDefault={() => onMakeDefault(address)}
  >
    <address className={classes.details}>
      {addressLines(address).map(line => (
        <span key={line}>{line}</span>
      ))}
    </address>
  </AccountCard>
);

export default AddressCard;
