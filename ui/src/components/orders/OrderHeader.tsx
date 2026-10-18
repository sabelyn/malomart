import { Badge, Button, Text, Title, VisuallyHidden } from "@mantine/core";
import type { OrderDto } from "@mm/lib/orders";
import { OrderStatus } from "@mm/lib/orders";
import type { Ref } from "react";

import { formatOrderDate, isCancellable, orderNumber } from "./orderDisplay";
import classes from "./orders.module.css";

type OrderHeaderProps = {
  order: OrderDto;
  headingRef?: Ref<HTMLHeadingElement>;
  onCancel: () => void;
};

const OrderHeader = ({ order, headingRef, onCancel }: OrderHeaderProps) => {
  const { currentStatus, orderDate } = order;

  return (
    <div className={classes.header}>
      <div>
        <Title order={1} ref={headingRef} tabIndex={-1}>
          Order {orderNumber(order.id)}
        </Title>
        <Text className={classes.placedOn}>
          Placed {formatOrderDate(orderDate)}.{" "}
          <Badge component="span" variant="outline" color={currentStatus === OrderStatus.Cancelled ? "red.4" : "gold"}>
            <VisuallyHidden>Status: </VisuallyHidden>
            {currentStatus}
          </Badge>
        </Text>
      </div>
      {isCancellable(currentStatus) && (
        <Button variant="outline" color="red.4" onClick={onCancel}>
          Cancel order
        </Button>
      )}
    </div>
  );
};

export default OrderHeader;
