import { Alert } from "@mantine/core";

import classes from "./cart.module.css";

type CartAdjustmentsAlertProps = {
  notices: string[];
  onClose: () => void;
};

const CartAdjustmentsAlert = ({ notices, onClose }: CartAdjustmentsAlertProps) => (
  <Alert
    mt="xl"
    variant="light"
    color="gilt"
    title="I fixed your cart"
    withCloseButton
    closeButtonLabel="Dismiss"
    onClose={onClose}
  >
    <ul className={classes.notices}>
      {notices.map(notice => (
        <li key={notice}>{notice}</li>
      ))}
    </ul>
  </Alert>
);

export default CartAdjustmentsAlert;
