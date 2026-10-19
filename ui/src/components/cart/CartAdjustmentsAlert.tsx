import { Alert } from "@mantine/core";

import { alerts, ui } from "@/copy";
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
    title={alerts.cartAdjustments.title}
    withCloseButton
    closeButtonLabel={ui.common.dismiss}
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
