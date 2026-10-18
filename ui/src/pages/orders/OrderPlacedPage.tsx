import { Button, Container, Group } from "@mantine/core";
import { getOrder, getOrderTotal } from "@mm/lib/orders";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { endpointQuery } from "@/api";
import { itemsLabel } from "@/components/checkout/checkoutDisplay";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { orderNumber } from "@/components/orders/orderDisplay";
import OrderFacts from "@/components/orders/OrderFacts";
import OrderLoadError from "@/components/orders/OrderLoadError";
import OrderSection from "@/components/orders/OrderSection";
import { useOrderItems } from "@/components/orders/useOrderItems";
import PageLoader from "@/components/PageLoader";
import { formatRupees } from "@/components/product/PriceTag";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CATALOG_PATH, orderPath } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

const OrderPlacedPage = () => {
  useDocumentTitle("Order placed");
  const { id = "" } = useParams();
  const order = useQuery(endpointQuery(getOrder, { params: { id } }));
  const { items, count, isPending: itemsPending } = useOrderItems(order.data);

  if (order.isPending) {
    return <PageLoader />;
  }
  if (!order.data) {
    return <OrderLoadError error={order.error} onRetry={() => void order.refetch()} />;
  }

  const number = orderNumber(order.data.id);

  return (
    <Container size="lg" className={classes.page}>
      <ChudleyHype>Sold! A purchase for the ages!</ChudleyHype>
      <MaloSays>Order {number} is in. Now go away so I can pack it.</MaloSays>

      <OrderSection id="order-placed-details" title="The details">
        <OrderFacts
          order={order.data}
          before={
            <>
              <dt>Order number</dt>
              <dd>{number}</dd>
            </>
          }
          after={
            <>
              <dt>Total</dt>
              <dd>
                {formatRupees(getOrderTotal(order.data))} rupees for {itemsLabel(count)}
              </dd>
            </>
          }
        />
      </OrderSection>

      <OrderSection id="order-placed-items" title="What you bought">
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
      </OrderSection>

      <Group mt="xl">
        <Button component={Link} to={orderPath(order.data.id)}>
          View order details
        </Button>
        <Button component={Link} to={CATALOG_PATH} variant="outline">
          Keep shopping
        </Button>
      </Group>
    </Container>
  );
};

export default OrderPlacedPage;
