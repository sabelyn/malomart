import { Button, Container, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Link } from "react-router";

import MaloSays from "@/components/MaloSays";
import { malo, ui } from "@/copy";
import { ACCOUNT_ORDERS_PATH } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

type OrderLoadErrorProps = {
  error: unknown;
  onRetry: () => void;
};

const OrderLoadError = ({ error, onRetry }: OrderLoadErrorProps) => {
  const missing = error instanceof ApiRequestError && error.status === 404;

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1}>{ui.orders.loadErrorHeading}</Title>
      <div role="alert">
        <MaloSays>{missing ? malo.orders.orderMissing : malo.orders.orderFailed}</MaloSays>
        {missing ? (
          <Button component={Link} to={ACCOUNT_ORDERS_PATH} mt="lg" variant="outline">
            {ui.orders.yourOrders}
          </Button>
        ) : (
          <Button mt="lg" variant="outline" onClick={onRetry}>
            {ui.common.tryAgain}
          </Button>
        )}
      </div>
    </Container>
  );
};

export default OrderLoadError;
