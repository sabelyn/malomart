import { Badge, Text } from "@mantine/core";
import type { PaymentMethodDto } from "@mm/lib/customers";
import { isCardExpired } from "@mm/lib/customers";

import { paymentMethodExpiry, paymentMethodName } from "@/components/account/accountDisplay";
import AccountCard from "./AccountCard";
import classes from "./AccountCard.module.css";

type PaymentMethodCardProps = {
  method: PaymentMethodDto;
  focusEdit: boolean;
  makingDefault: boolean;
  onEdit: (method: PaymentMethodDto) => void;
  onDelete: (method: PaymentMethodDto) => void;
  onMakeDefault: (method: PaymentMethodDto) => void;
};

const PaymentMethodCard = ({
  method,
  focusEdit,
  makingDefault,
  onEdit,
  onDelete,
  onMakeDefault
}: PaymentMethodCardProps) => (
  <AccountCard
    id={method.id}
    title={paymentMethodName(method)}
    isDefault={method.isDefault}
    badges={
      isCardExpired(method) && (
        <Badge variant="outline" color="red.4">
          Expired
        </Badge>
      )
    }
    focusEdit={focusEdit}
    makingDefault={makingDefault}
    onEdit={() => onEdit(method)}
    onDelete={() => onDelete(method)}
    onMakeDefault={() => onMakeDefault(method)}
  >
    <Text className={classes.details}>{paymentMethodExpiry(method)}</Text>
  </AccountCard>
);

export default PaymentMethodCard;
