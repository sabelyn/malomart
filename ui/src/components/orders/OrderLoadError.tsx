import { Button, Container, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { Link } from "react-router";

import MaloSays from "@/components/MaloSays";
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
      <Title order={1}>Order</Title>
      <div role="alert">
        <MaloSays>
          {missing ? "No order by that number. Check your orders." : "Couldn't find that order. Not my fault."}
        </MaloSays>
        {missing ? (
          <Button component={Link} to={ACCOUNT_ORDERS_PATH} mt="lg" variant="outline">
            Your orders
          </Button>
        ) : (
          <Button mt="lg" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    </Container>
  );
};

export default OrderLoadError;
