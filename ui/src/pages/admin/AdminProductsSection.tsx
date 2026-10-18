import { Button, Chip, Group, NativeSelect, Text, Title } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { Category, CategorySchema, deleteProduct, ListProductsQuery, listProducts, products } from "@mm/lib/products";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router";

import { endpointInfiniteQuery, useEndpointMutation } from "@/api";
import classes from "@/components/admin/admin.module.css";
import AdminProductList from "@/components/admin/AdminProductList";
import ConfirmModal from "@/components/ConfirmModal";
import orderClasses from "@/components/orders/orders.module.css";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { useSchemaSearch } from "@/hooks/useSchemaSearch";
import accountClasses from "../account/account.module.css";

const PAGE_SIZE = 50;
const ALL = "all";

const ProductsSearch = ListProductsQuery.pick({ category: true, inStock: true });

const STOCK_FILTERS = [
  { value: ALL, label: "All" },
  { value: "true", label: "In stock" },
  { value: "false", label: "Out of stock" }
];

const statusText = (count: number, hasMore: boolean) => {
  if (count === 0) {
    return "No products found.";
  }
  return `Showing ${hasMore ? "the first " : ""}${count} product${count === 1 ? "" : "s"}.`;
};

type DeleteState = { opened: boolean; target?: ProductOverview };

const AdminProductsSection = () => {
  useDocumentTitle("Products · Back office");
  const [{ category, inStock }, updateSearch] = useSchemaSearch(ProductsSearch);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const deletedRef = useRef(false);
  const [deleting, setDeleting] = useState<DeleteState>({ opened: false });
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
      deletedRef.current = true;
      setStatus(`Deleted ${deleting.target?.title ?? "the product"}.`);
      setDeleting(current => ({ ...current, opened: false }));
    }
  });

  const openDelete = (product: ProductOverview) => {
    remove.reset();
    setDeleting({ opened: true, target: product });
  };

  const afterDeleteClosed = () => {
    if (deletedRef.current) {
      deletedRef.current = false;
      headingRef.current?.focus();
    }
  };

  const items = data?.pages.flatMap(page => page.data) ?? [];

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!data) {
      return (
        <div role="alert">
          <Text>Couldn't load products.</Text>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
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
      <div className={accountClasses.sectionHeader}>
        <Title
          order={2}
          id="admin-products-heading"
          ref={headingRef}
          tabIndex={-1}
          className={accountClasses.sectionTitle}
        >
          Products
        </Title>
        <Button component={Link} to="/admin/products/new">
          New product
        </Button>
      </div>
      <Text role="status" className={classes.status}>
        {status}
      </Text>
      <div className={classes.filters}>
        <NativeSelect
          label="Category"
          className={classes.categorySelect}
          value={category ?? ALL}
          data={[{ value: ALL, label: "All categories" }, ...Object.values(Category)]}
          onChange={event => {
            const { value } = event.currentTarget;
            updateSearch({ category: value === ALL ? undefined : CategorySchema.parse(value) });
          }}
        />
        <fieldset className={orderClasses.filter}>
          <legend className={orderClasses.filterLegend}>Stock</legend>
          <Chip.Group
            value={inStock === undefined ? ALL : String(inStock)}
            onChange={value => updateSearch({ inStock: value === ALL ? undefined : value === "true" })}
          >
            <Group gap="xs">
              {STOCK_FILTERS.map(({ value, label }) => (
                <Chip key={value} type="radio" name="stock" value={value} classNames={{ label: orderClasses.chip }}>
                  {label}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </fieldset>
      </div>
      <Text role="status" className={orderClasses.count}>
        {data && statusText(items.length, hasNextPage)}
      </Text>
      {renderContent()}

      <ConfirmModal
        opened={deleting.opened}
        title={`Delete ${deleting.target?.title ?? "this product"}?`}
        confirmLabel="Delete product"
        dismissLabel="Keep it"
        pending={remove.isPending}
        error={remove.isError ? "Couldn't delete the product. Try again." : undefined}
        onConfirm={() => deleting.target && remove.mutate({ params: { id: deleting.target.id } })}
        onClose={() => setDeleting(current => ({ ...current, opened: false }))}
        onExitTransitionEnd={afterDeleteClosed}
      >
        It comes out of the catalog along with its images. Past orders keep its name.
      </ConfirmModal>
    </section>
  );
};

export default AdminProductsSection;
