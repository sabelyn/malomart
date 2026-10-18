import { Button, Text, Title } from "@mantine/core";
import type { OrderStatus } from "@mm/lib/orders";
import { ListOrdersQuery, listOrders } from "@mm/lib/orders";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { endpointInfiniteQuery } from "@/api";
import OrderList from "@/components/orders/OrderList";
import orderClasses from "@/components/orders/orders.module.css";
import OrderStatusFilter from "@/components/orders/OrderStatusFilter";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import accountClasses from "../account/account.module.css";

const PAGE_SIZE = 25;

const OrdersSearch = ListOrdersQuery.pick({ status: true });

const statusText = (count: number, hasMore: boolean, status?: OrderStatus) => {
  if (count === 0) {
    return "No orders found.";
  }
  const kind = status ? `${status.toLowerCase()} ` : "";
  return `Showing ${hasMore ? "the newest " : ""}${count} ${kind}order${count === 1 ? "" : "s"}.`;
};

export const adminOrderPath = (id: string) => `/admin/orders/${id}`;

const AdminOrdersSection = () => {
  useDocumentTitle("Orders · Back office");
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
          <Text>Couldn't load orders.</Text>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (orders.length === 0) {
      return null;
    }
    return (
      <OrderList
        orders={orders}
        orderPath={adminOrderPath}
        showRecipient
        busy={isPlaceholderData}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        loadMoreFailed={isFetchNextPageError}
        onShowMore={() => void fetchNextPage()}
      />
    );
  };

  return (
    <section aria-labelledby="admin-orders-heading">
      <div className={accountClasses.sectionHeader}>
        <Title order={2} id="admin-orders-heading" className={accountClasses.sectionTitle}>
          Orders
        </Title>
      </div>
      <OrderStatusFilter status={status} onChange={value => updateSearch({ status: value })} />
      <Text role="status" className={orderClasses.count}>
        {data && statusText(orders.length, hasNextPage, status)}
      </Text>
      {renderContent()}
    </section>
  );
};

export default AdminOrdersSection;
