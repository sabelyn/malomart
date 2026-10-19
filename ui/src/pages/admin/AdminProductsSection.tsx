import { Button, Text } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { deleteProduct, ListProductsQuery, listProducts, products } from "@mm/lib/products";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { endpointInfiniteQuery, useEndpointMutation } from "@/api";
import classes from "@/components/admin/admin.module.css";
import AdminProductFilters from "@/components/admin/AdminProductFilters";
import AdminProductList from "@/components/admin/AdminProductList";
import ConfirmModal from "@/components/ConfirmModal";
import SectionHeader from "@/components/layout/SectionHeader";
import orderClasses from "@/components/orders/orders.module.css";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { alerts, statusMessages, ui } from "@/copy";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import { ADMIN_NEW_PRODUCT_PATH } from "@/routes/paths";

const PAGE_SIZE = 50;

const ProductsSearch = ListProductsQuery.pick({ category: true, inStock: true });

const AdminProductsSection = () => {
  useDocumentTitle(ui.pageTitles.adminProducts);
  const [{ category, inStock }, updateSearch] = useSchemaSearch(ProductsSearch);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deleting = useConfirmDialog<ProductOverview>(headingRef);
  const [status, setStatus] = useState("");

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
    ...endpointInfiniteQuery(listProducts, { query: { category, inStock, limit: PAGE_SIZE } }),
    placeholderData: keepPreviousData
  });

  const remove = useEndpointMutation(deleteProduct, {
    invalidates: [products],
    onSuccess: () => {
      setStatus(statusMessages.admin.productDeleted(deleting.target?.title));
      deleting.complete();
    }
  });

  const openDelete = (product: ProductOverview) => {
    remove.reset();
    deleting.open(product);
  };

  const items = data?.pages.flatMap(page => page.data) ?? [];

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!data) {
      return (
        <RetryAlert onRetry={() => void refetch()}>
          <Text>{alerts.admin.productsFailed}</Text>
        </RetryAlert>
      );
    }
    if (items.length === 0) {
      return null;
    }
    return (
      <AdminProductList
        products={items}
        busy={isPlaceholderData}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        loadMoreFailed={isFetchNextPageError}
        onShowMore={() => void fetchNextPage()}
        onDelete={openDelete}
      />
    );
  };

  return (
    <section aria-labelledby="admin-products-heading">
      <SectionHeader id="admin-products-heading" title={ui.admin.productsHeading} headingRef={headingRef}>
        <Button component={Link} to={ADMIN_NEW_PRODUCT_PATH}>
          {ui.admin.newProduct}
        </Button>
      </SectionHeader>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      <AdminProductFilters category={category} inStock={inStock} onChange={updateSearch} />
      <Text role="status" className={orderClasses.count}>
        {data && !isPlaceholderData && statusMessages.admin.productCount(items.length, hasNextPage)}
      </Text>
      {renderContent()}

      <ConfirmModal
        opened={deleting.opened}
        title={ui.admin.deleteTitle(deleting.target?.title)}
        confirmLabel={ui.admin.deleteConfirm}
        dismissLabel={ui.common.keepIt}
        pending={remove.isPending}
        error={remove.isError ? alerts.admin.deleteProductFailed : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={deleting.close}
        onExitTransitionEnd={deleting.afterClose}
      >
        {ui.admin.deleteFromListWarning}
      </ConfirmModal>
    </section>
  );
};

export default AdminProductsSection;
