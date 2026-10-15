import { Button, Container, Group, Title } from "@mantine/core";
import { ApiRequestError } from "@mm/lib/api";
import { getOrder, getOrderTotal, ShippingOptions } from "@mm/lib/orders";
import { getProductsByIds } from "@mm/lib/products";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";

import { endpointQuery } from "@/api";
import { itemsLabel, shippingCostLabel } from "@/components/checkout/checkoutDisplay";
import CheckoutItems from "@/components/checkout/CheckoutItems";
import ChudleyHype from "@/components/ChudleyHype";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { formatRupees } from "@/components/PriceTag";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "../pages.module.css";
import orderClasses from "./orders.module.css";

const orderNumber = (id: string) => id.slice(0, 8).toUpperCase();

const OrderPlacedPage = () => {
  useDocumentTitle("Order placed");
  const { id = "" } = useParams();
  const order = useQuery(endpointQuery(getOrder, { params: { id } }));
  const productIds = Object.keys(order.data?.products ?? {}).sort();
  const products = useQuery({
    ...endpointQuery(getProductsByIds, { query: { ids: productIds } }),
    enabled: productIds.length > 0
  });

  if (order.isPending) {
    return <PageLoader />;
  }
  if (!order.data) {
    const missing = order.error instanceof ApiRequestError && order.error.status === 404;
    return (
      <Container size="lg" className={classes.page}>
        <Title order={1}>Order</Title>
        <div role="alert">
          <MaloSays>
            {missing ? "No order by that number. Check your orders." : "Couldn't find that order. Not my fault."}
          </MaloSays>
          {missing ? (
            <Button component={Link} to="/account/orders" mt="lg" variant="outline">
              Your orders
            </Button>
          ) : (
            <Button mt="lg" variant="outline" onClick={() => void order.refetch()}>
              Try again
            </Button>
          )}
        </div>
      </Container>
    );
  }

  const { address, paymentMethod, shipping } = order.data;
  const titles = new Map((products.data ?? []).map(product => [product.id, product]));
  const entries = Object.entries(order.data.products);
  const count = entries.reduce((total, [, { amount }]) => total + amount, 0);
  const items = entries.map(([productId, { amount, pricePerUnit }]) => ({
    id: productId,
    title: titles.get(productId)?.title ?? "Item no longer sold",
    thumbnailKey: titles.get(productId)?.thumbnailKey,
    amount,
    pricePerUnit
  }));
  items.sort((a, b) => a.title.localeCompare(b.title));

  return (
    <Container size="lg" className={classes.page}>
      <ChudleyHype>Sold! A purchase for the ages!</ChudleyHype>
      <MaloSays>Order {orderNumber(order.data.id)} is in. Now go away so I can pack it.</MaloSays>

      <section aria-labelledby="order-placed-details" className={orderClasses.section}>
        <Title order={2} id="order-placed-details" className={orderClasses.sectionTitle}>
          The details
        </Title>
        <dl className={orderClasses.facts}>
          <dt>Order number</dt>
          <dd>{orderNumber(order.data.id)}</dd>
          <dt>Ship to</dt>
          <dd>
            <address>
              <span>{address.recipient}</span>
              <span>{address.street}</span>
              <span>
                {address.city}, {address.region} {address.postalCode}
              </span>
            </address>
          </dd>
          <dt>Delivery</dt>
          <dd>
            {ShippingOptions[shipping.method].name}, {ShippingOptions[shipping.method].description.toLowerCase()}.{" "}
            {shippingCostLabel(shipping.cost)}.
          </dd>
          {paymentMethod && (
            <>
              <dt>Paid with</dt>
              <dd>
                {paymentMethod.brand} ending in {paymentMethod.lastFour}
              </dd>
            </>
          )}
          <dt>Total</dt>
          <dd>
            {formatRupees(getOrderTotal(order.data))} rupees for {itemsLabel(count)}
          </dd>
        </dl>
      </section>

      <section aria-labelledby="order-placed-items" className={orderClasses.section}>
        <Title order={2} id="order-placed-items" className={orderClasses.sectionTitle}>
          What you bought
        </Title>
        {products.isPending ? <PageLoader /> : <CheckoutItems items={items} />}
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
