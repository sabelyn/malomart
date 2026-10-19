import { Text } from "@mantine/core";
import { ListOrdersQuery, listOrders } from "@mm/lib/orders";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { endpointInfiniteQuery } from "@/api";
import SectionHeader from "@/components/layout/SectionHeader";
import OrderList from "@/components/orders/OrderList";
import orderClasses from "@/components/orders/orders.module.css";
import OrderStatusFilter from "@/components/orders/OrderStatusFilter";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { alerts, statusMessages, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import { adminOrderPath } from "@/routes/paths";

const PAGE_SIZE = 25;

const OrdersSearch = ListOrdersQuery.pick({ status: true });

const AdminOrdersSection = () => {
  useDocumentTitle(ui.pageTitles.adminOrders);
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
          <Text>{alerts.admin.ordersFailed}</Text>
        </RetryAlert>
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
      <SectionHeader id="admin-orders-heading" title={ui.admin.ordersHeading} />
      <OrderStatusFilter status={status} onChange={value => updateSearch({ status: value })} />
      <Text role="status" className={orderClasses.count}>
        {data && !isPlaceholderData && statusMessages.admin.orderCount(orders.length, hasNextPage, status)}
      </Text>
      {renderContent()}
    </section>
  );
};

export default AdminOrdersSection;
