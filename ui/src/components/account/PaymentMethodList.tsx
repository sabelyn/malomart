import type { PaymentMethodDto } from "@mm/lib/customers";

import classes from "./account.module.css";
import PaymentMethodCard from "./PaymentMethodCard";

type PaymentMethodListProps = {
  methods: PaymentMethodDto[];
  focusEditId?: string;
  makingDefaultId?: string;
  onEdit: (method: PaymentMethodDto) => void;
  onDelete: (method: PaymentMethodDto) => void;
  onMakeDefault: (method: PaymentMethodDto) => void;
};

const defaultFirst = (a: PaymentMethodDto, b: PaymentMethodDto) => Number(b.isDefault) - Number(a.isDefault);

const PaymentMethodList = ({
  methods,
  focusEditId,
  makingDefaultId,
  onEdit,
  onDelete,
  onMakeDefault
}: PaymentMethodListProps) => (
  <ul className={classes.cards}>
    {[...methods].sort(defaultFirst).map(method => (
      <li key={method.id}>
        <PaymentMethodCard
          method={method}
          focusEdit={focusEditId === method.id}
          makingDefault={makingDefaultId === method.id}
          onEdit={onEdit}
          onDelete={onDelete}
          onMakeDefault={onMakeDefault}
        />
      </li>
    ))}
  </ul>
);

export default PaymentMethodList;
