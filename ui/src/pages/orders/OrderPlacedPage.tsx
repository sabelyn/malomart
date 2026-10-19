import { Button, Container, Group } from "@mantine/core";
import { getOrder, getOrderTotal } from "@mm/lib/orders";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { endpointQuery } from "@/api";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import { orderNumber } from "@/components/orders/orderDisplay";
import OrderFacts from "@/components/orders/OrderFacts";
import OrderLoadError from "@/components/orders/OrderLoadError";
import OrderSection from "@/components/orders/OrderSection";
import { useOrderItems } from "@/components/orders/useOrderItems";
import PageLoader from "@/components/PageLoader";
import { chudley, malo, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { CATALOG_PATH, orderPath } from "@/routes/paths";
import classes from "@/styles/pages.module.css";

const OrderPlacedPage = () => {
  useDocumentTitle(ui.pageTitles.orderPlaced);
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
      <ChudleyHype>{chudley.orderPlaced}</ChudleyHype>
      <MaloSays>{malo.orders.placed(number)}</MaloSays>

      <OrderSection id="order-placed-details" title={ui.orders.placedDetails}>
        <OrderFacts
          order={order.data}
          before={
            <>
              <dt>{ui.orders.orderNumber}</dt>
              <dd>{number}</dd>
            </>
          }
          after={
            <>
              <dt>{ui.common.total}</dt>
              <dd>{ui.orders.placedTotal(getOrderTotal(order.data), count)}</dd>
            </>
          }
        />
      </OrderSection>

      <OrderSection id="order-placed-items" title={ui.orders.whatYouBought}>
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
      </OrderSection>

      <Group mt="xl">
        <Button component={Link} to={orderPath(order.data.id)}>
          {ui.orders.viewDetails}
        </Button>
        <Button component={Link} to={CATALOG_PATH} variant="outline">
          {ui.orders.keepShopping}
        </Button>
      </Group>
    </Container>
  );
};

export default OrderPlacedPage;
