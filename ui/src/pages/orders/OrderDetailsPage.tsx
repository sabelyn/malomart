import { Container, Text } from "@mantine/core";
import { cancelOrder, getOrder, orders } from "@mm/lib/orders";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { endpointQuery, useEndpointMutation } from "@/api";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import ConfirmModal from "@/components/ConfirmModal";
import { orderNumber } from "@/components/orders/orderDisplay";
import OrderFacts from "@/components/orders/OrderFacts";
import OrderHeader from "@/components/orders/OrderHeader";
import OrderLoadError from "@/components/orders/OrderLoadError";
import orderClasses from "@/components/orders/orders.module.css";
import OrderSection from "@/components/orders/OrderSection";
import OrderTotals from "@/components/orders/OrderTotals";
import OrderUpdates from "@/components/orders/OrderUpdates";
import { useOrderItems } from "@/components/orders/useOrderItems";
import PageLoader from "@/components/PageLoader";
import { alerts, statusMessages, ui } from "@/copy";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ACCOUNT_ORDERS_PATH } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

type OrderDetailsPageProps = {
  backTo?: string;
  backLabel?: string;
};

const OrderDetailsPage = ({
  backTo = ACCOUNT_ORDERS_PATH,
  backLabel = ui.orders.allYourOrders
}: OrderDetailsPageProps) => {
  const { id = "" } = useParams();
  const order = useQuery(endpointQuery(getOrder, { params: { id } }));
  const { items, isPending: itemsPending } = useOrderItems(order.data);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirming = useConfirmDialog(headingRef);
  const [status, setStatus] = useState("");
  useDocumentTitle(ui.pageTitles.order(order.data && orderNumber(order.data.id)));

  const cancel = useEndpointMutation(cancelOrder, {
    invalidates: [orders],
    onSuccess: () => {
      setStatus(statusMessages.orders.cancelled);
      confirming.complete();
    }
  });

  const openCancel = () => {
    cancel.reset();
    confirming.open();
  };

  if (order.isPending) {
    return <PageLoader />;
  }
  if (!order.data) {
    return <OrderLoadError error={order.error} onRetry={() => void order.refetch()} />;
  }

  return (
    <Container size="lg" className={classes.page}>
      <OrderHeader order={order.data} headingRef={headingRef} onCancel={openCancel} />
      <Text role="status" className={orderClasses.status}>
        {status}
      </Text>

      <OrderSection id="order-updates-heading" title={ui.orders.updates}>
        <OrderUpdates order={order.data} />
      </OrderSection>

      <OrderSection id="order-details-heading" title={ui.orders.details}>
        <OrderFacts order={order.data} />
      </OrderSection>

      <OrderSection id="order-items-heading" title={ui.orders.items}>
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
        <OrderTotals order={order.data} />
      </OrderSection>

      <Link to={backTo} className={orderClasses.backLink}>
        {backLabel}
      </Link>

      <ConfirmModal
        opened={confirming.opened}
        title={ui.orders.cancelTitle}
        confirmLabel={ui.orders.cancel}
        dismissLabel={ui.orders.keepOrder}
        pending={cancel.isPending}
        error={cancel.isError ? alerts.orders.cancelFailed : undefined}
        onConfirm={() => cancel.mutate({ params: { id: order.data.id } })}
        onClose={confirming.close}
        onExitTransitionEnd={confirming.afterClose}
      >
        {ui.orders.cancelWarning(orderNumber(order.data.id))}
      </ConfirmModal>
    </Container>
  );
};

export default OrderDetailsPage;
