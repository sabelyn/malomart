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
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ACCOUNT_ORDERS_PATH } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

type OrderDetailsPageProps = {
  backTo?: string;
  backLabel?: string;
};

const OrderDetailsPage = ({ backTo = ACCOUNT_ORDERS_PATH, backLabel = "All your orders" }: OrderDetailsPageProps) => {
  const { id = "" } = useParams();
  const order = useQuery(endpointQuery(getOrder, { params: { id } }));
  const { items, isPending: itemsPending } = useOrderItems(order.data);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const confirming = useConfirmDialog(headingRef);
  const [status, setStatus] = useState("");
  useDocumentTitle(order.data ? `Order ${orderNumber(order.data.id)}` : "Order");

  const cancel = useEndpointMutation(cancelOrder, {
    invalidates: [orders],
    onSuccess: () => {
      setStatus("Order cancelled.");
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

      <OrderSection id="order-updates-heading" title="Order updates">
        <OrderUpdates order={order.data} />
      </OrderSection>

      <OrderSection id="order-details-heading" title="Details">
        <OrderFacts order={order.data} />
      </OrderSection>

      <OrderSection id="order-items-heading" title="Items">
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
        <OrderTotals order={order.data} />
      </OrderSection>

      <Link to={backTo} className={orderClasses.backLink}>
        {backLabel}
      </Link>

      <ConfirmModal
        opened={confirming.opened}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        dismissLabel="Keep order"
        pending={cancel.isPending}
        error={cancel.isError ? "Couldn't cancel the order. It may have already shipped." : undefined}
        onConfirm={() => cancel.mutate({ params: { id: order.data.id } })}
        onClose={confirming.close}
        onExitTransitionEnd={confirming.afterClose}
      >
        {`Order ${orderNumber(order.data.id)} won't ship. No take-backs.`}
      </ConfirmModal>
    </Container>
  );
};

export default OrderDetailsPage;
