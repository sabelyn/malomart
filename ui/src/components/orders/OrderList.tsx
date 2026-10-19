import { Badge, Button, Group, Text, Title, VisuallyHidden } from "@mantine/core";
import type { OrderOverview } from "@mm/lib/orders";
import { OrderStatus } from "@mm/lib/orders";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { alerts, rupees, ui } from "@/copy";
import { orderPath as customerOrderPath } from "@/routes/paths";
import { formatOrderDate, orderNumber } from "./orderDisplay";
import classes from "./orders.module.css";

type OrderListProps = {
  orders: OrderOverview[];
  orderPath?: (id: string) => string;
  showRecipient?: boolean;
  busy: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onShowMore: () => void;
};

const OrderList = ({
  orders,
  orderPath = customerOrderPath,
  showRecipient = false,
  busy,
  hasMore,
  loadingMore,
  loadMoreFailed,
  onShowMore
}: OrderListProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState<number>();

  useEffect(() => {
    if (focusIndex === undefined || orders.length <= focusIndex) {
      return;
    }
    listRef.current?.querySelectorAll<HTMLAnchorElement>(`.${classes.orderLink}`)[focusIndex]?.focus();
    setFocusIndex(undefined);
  }, [focusIndex, orders.length]);

  const showMore = () => {
    setFocusIndex(orders.length);
    onShowMore();
  };

  return (
    <>
      <ul ref={listRef} aria-busy={busy} className={classes.orderList}>
        {orders.map(({ id, orderDate, currentStatus, recipient, total, itemCount }) => (
          <li key={id} className={classes.orderRow}>
            <div>
              <Title order={3} className={classes.orderTitle}>
                <Link to={orderPath(id)} className={classes.orderLink}>
                  {ui.orders.order(orderNumber(id))}
                </Link>
                <Badge
                  component="span"
                  variant="outline"
                  color={currentStatus === OrderStatus.Cancelled ? "red.4" : "gold"}
                >
                  <VisuallyHidden>{ui.common.statusPrefix}</VisuallyHidden>
                  {currentStatus}
                </Badge>
              </Title>
              <Text className={classes.orderMeta}>
                {ui.orders.listMeta(formatOrderDate(orderDate), itemCount, showRecipient ? recipient : undefined)}
              </Text>
            </div>
            <Text className={classes.orderTotal}>{rupees(total)}</Text>
          </li>
        ))}
      </ul>
      {hasMore && (
        <Group justify="center" mt="xl">
          <Button variant="outline" onClick={showMore} loading={loadingMore}>
            {ui.common.showMore}
          </Button>
        </Group>
      )}
      {loadMoreFailed && (
        <Text role="alert" ta="center" mt="md" c="red.4">
          {alerts.loadMoreFailed}
        </Text>
      )}
    </>
  );
};

export default OrderList;
