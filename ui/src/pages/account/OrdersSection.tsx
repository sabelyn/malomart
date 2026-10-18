import { Button, Text } from "@mantine/core";
import type { OrderStatus } from "@mm/lib/orders";
import { ListOrdersQuery, listOrders } from "@mm/lib/orders";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "react-router";

import { endpointInfiniteQuery } from "@/api";
import SectionHeader from "@/components/layout/SectionHeader";
import MaloSays from "@/components/MaloSays";
import OrderList from "@/components/orders/OrderList";
import orderClasses from "@/components/orders/orders.module.css";
import OrderStatusFilter from "@/components/orders/OrderStatusFilter";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import { CATALOG_PATH } from "@/routes/paths";

const PAGE_SIZE = 20;

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
        <RetryAlert onRetry={() => void refetch()}>
          <MaloSays>Couldn't find your orders. Not my fault.</MaloSays>
        </RetryAlert>
      );
    }
    if (orders.length === 0) {
      return status ? (
        <MaloSays>Nothing {status.toLowerCase()}. Try another.</MaloSays>
      ) : (
        <>
          <MaloSays>No orders yet. The shelves aren't going to empty themselves.</MaloSays>
          <Button mt="lg" component={Link} to={CATALOG_PATH}>
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
      <SectionHeader id="orders-heading" title="Orders" />
      <OrderStatusFilter status={status} onChange={value => updateSearch({ status: value })} />
      <Text role="status" className={orderClasses.count}>
        {data && statusText(orders.length, hasNextPage, status)}
      </Text>
      {renderContent()}
    </section>
  );
};

export default OrdersSection;
