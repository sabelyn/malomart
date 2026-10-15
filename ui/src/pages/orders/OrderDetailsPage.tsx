import { Badge, Button, Container, Text, Title, VisuallyHidden } from "@mantine/core";
import { cancelOrder, getOrder, getOrderSubtotal, getOrderTotal, OrderStatus, orders } from "@mm/lib/orders";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useParams } from "react-router";

import { endpointQuery, useEndpointMutation } from "@/api";
import { itemsLabel, shippingCostLabel } from "@/components/checkout/checkoutDisplay";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import ConfirmModal from "@/components/ConfirmModal";
import { formatOrderDate, isCancellable, orderNumber } from "@/components/orders/orderDisplay";
import OrderFacts from "@/components/orders/OrderFacts";
import OrderLoadError from "@/components/orders/OrderLoadError";
import orderClasses from "@/components/orders/orders.module.css";
import OrderUpdates from "@/components/orders/OrderUpdates";
import { useOrderItems } from "@/components/orders/useOrderItems";
import PageLoader from "@/components/PageLoader";
import { formatRupees } from "@/components/PriceTag";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "../pages.module.css";

const OrderDetailsPage = () => {
  const { id = "" } = useParams();
  const order = useQuery(endpointQuery(getOrder, { params: { id } }));
  const { items, count, isPending: itemsPending } = useOrderItems(order.data);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelledRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");
  useDocumentTitle(order.data ? `Order ${orderNumber(order.data.id)}` : "Order");

  const cancel = useEndpointMutation(cancelOrder, {
    invalidates: [orders],
    onSuccess: () => {
      cancelledRef.current = true;
      setStatus("Order cancelled.");
      setConfirming(false);
    }
  });

  const openCancel = () => {
    cancel.reset();
    setConfirming(true);
  };

  const afterCancelClosed = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      headingRef.current?.focus();
    }
  };

  if (order.isPending) {
    return <PageLoader />;
  }
  if (!order.data) {
    return <OrderLoadError error={order.error} onRetry={() => void order.refetch()} />;
  }

  const { currentStatus, orderDate, products, shipping } = order.data;
  const number = orderNumber(order.data.id);

  return (
    <Container size="lg" className={classes.page}>
      <div className={orderClasses.header}>
        <div>
          <Title order={1} ref={headingRef} tabIndex={-1}>
            Order {number}
          </Title>
          <Text className={orderClasses.placedOn}>
            Placed {formatOrderDate(orderDate)}.{" "}
            <Badge component="span" variant="outline" color={currentStatus === OrderStatus.Cancelled ? "red.4" : "gold"}>
              <VisuallyHidden>Status: </VisuallyHidden>
              {currentStatus}
            </Badge>
          </Text>
        </div>
        {isCancellable(currentStatus) && (
          <Button variant="outline" color="red.4" onClick={openCancel}>
            Cancel order
          </Button>
        )}
      </div>
      <Text role="status" className={orderClasses.status}>
        {status}
      </Text>

      <section aria-labelledby="order-updates-heading" className={orderClasses.section}>
        <Title order={2} id="order-updates-heading" className={orderClasses.sectionTitle}>
          Order updates
        </Title>
        <OrderUpdates order={order.data} />
      </section>

      <section aria-labelledby="order-details-heading" className={orderClasses.section}>
        <Title order={2} id="order-details-heading" className={orderClasses.sectionTitle}>
          Details
        </Title>
        <OrderFacts order={order.data} />
      </section>

      <section aria-labelledby="order-items-heading" className={orderClasses.section}>
        <Title order={2} id="order-items-heading" className={orderClasses.sectionTitle}>
          Items
        </Title>
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
        <dl className={orderClasses.totals}>
          <div>
            <dt>Subtotal, {itemsLabel(count)}</dt>
            <dd>{formatRupees(getOrderSubtotal(products))} rupees</dd>
          </div>
          <div>
            <dt>Delivery</dt>
            <dd>{shippingCostLabel(shipping.cost)}</dd>
          </div>
          <div className={orderClasses.grandTotal}>
            <dt>Total</dt>
            <dd>{formatRupees(getOrderTotal(order.data))} rupees</dd>
          </div>
        </dl>
      </section>

      <Link to="/account/orders" className={orderClasses.backLink}>
        All your orders
      </Link>

      <ConfirmModal
        opened={confirming}
        title="Cancel this order?"
        confirmLabel="Cancel order"
        dismissLabel="Keep order"
        pending={cancel.isPending}
        error={cancel.isError ? "Couldn't cancel the order. It may have already shipped." : undefined}
        onConfirm={() => cancel.mutate({ params: { id: order.data.id } })}
        onClose={() => setConfirming(false)}
        onExitTransitionEnd={afterCancelClosed}
      >
        {`Order ${number} won't ship. No take-backs.`}
      </ConfirmModal>
    </Container>
  );
};

export default OrderDetailsPage;
