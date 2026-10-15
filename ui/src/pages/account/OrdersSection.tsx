import { Button, Chip, Group, Text, Title } from "@mantine/core";
import type { OrderStatus } from "@mm/lib/orders";
import { ListOrdersQuery, listOrders, OrderStatusSchema } from "@mm/lib/orders";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointInfiniteQuery } from "@/api";
import MaloSays from "@/components/MaloSays";
import OrderList from "@/components/orders/OrderList";
import orderClasses from "@/components/orders/orders.module.css";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import classes from "./account.module.css";

const PAGE_SIZE = 20;
const ALL = "all";

const OrdersSearch = ListOrdersQuery.pick({ status: true });

const statusText = (count: number, hasMore: boolean, status?: OrderStatus) => {
  if (count === 0) {
    return "No orders found.";
  }
  const kind = status ? `${status.toLowerCase()} ` : "";
  return `Showing ${hasMore ? "the first " : ""}${count} ${kind}order${count === 1 ? "" : "s"}.`;
};

const OrdersSection = () => {
  useDocumentTitle("Orders");
  const [{ status }, updateSearch] = useSchemaSearch(OrdersSearch);

  const {
    data,
    isPending,
    isPlaceholderData,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    fetchNextPage,
    refetch
  } = useInfiniteQuery({
    ...endpointInfiniteQuery(listOrders, { query: { status, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData
  });

  const orders = data?.pages.flatMap(page => page.data) ?? [];

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!data) {
      return (
        <div role="alert">
          <MaloSays>Couldn't find your orders. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (orders.length === 0) {
      return status ? (
        <MaloSays>Nothing {status.toLowerCase()}. Try another.</MaloSays>
      ) : (
        <>
          <MaloSays>No orders yet. The shelves aren't going to empty themselves.</MaloSays>
          <Button mt="lg" component={Link} to="/products">
            Browse the catalog
          </Button>
        </>
      );
    }
    return (
      <OrderList
        orders={orders}
        busy={isPlaceholderData}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        loadMoreFailed={isFetchNextPageError}
        onShowMore={() => void fetchNextPage()}
      />
    );
  };

  return (
    <section aria-labelledby="orders-heading">
      <div className={classes.sectionHeader}>
        <Title order={2} id="orders-heading" className={classes.sectionTitle}>
          Orders
        </Title>
      </div>
      <fieldset className={orderClasses.filter}>
        <legend className={orderClasses.filterLegend}>Status</legend>
        <Chip.Group value={status ?? ALL} onChange={value => updateSearch({ status: value === ALL ? undefined : value })}>
          <Group gap="xs">
            <Chip type="radio" name="status" value={ALL} classNames={{ label: orderClasses.chip }}>
              All
            </Chip>
            {OrderStatusSchema.options.map(value => (
              <Chip key={value} type="radio" name="status" value={value} classNames={{ label: orderClasses.chip }}>
                {value}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </fieldset>
      <Text role="status" className={orderClasses.count}>
        {data && statusText(orders.length, hasNextPage, status)}
      </Text>
      {renderContent()}
    </section>
  );
};

export default OrdersSection;
