import { Button, Container, Group, Title } from "@mantine/core";
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
import orderClasses from "@/components/orders/orders.module.css";
import { useOrderItems } from "@/components/orders/useOrderItems";
import PageLoader from "@/components/PageLoader";
import { formatRupees } from "@/components/PriceTag";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "../pages.module.css";

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

      <section aria-labelledby="order-placed-details" className={orderClasses.section}>
        <Title order={2} id="order-placed-details" className={orderClasses.sectionTitle}>
          The details
        </Title>
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
      </section>

      <section aria-labelledby="order-placed-items" className={orderClasses.section}>
        <Title order={2} id="order-placed-items" className={orderClasses.sectionTitle}>
          What you bought
        </Title>
        {itemsPending ? <PageLoader /> : <CheckoutItems items={items} />}
      </section>

      <Group mt="xl">
        <Button component={Link} to={`/orders/${order.data.id}`}>
          View order details
        </Button>
        <Button component={Link} to="/products" variant="outline">
          Keep shopping
        </Button>
      </Group>
    </Container>
  );
};

export default OrderPlacedPage;
