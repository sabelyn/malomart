import { Button, Text } from "@mantine/core";
import { listProducts } from "@mm/lib/products";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

import { endpointInfiniteQuery } from "@/api";
import type { CatalogFilterValues } from "@/components/catalog/CatalogFilters";
import CatalogGrid from "@/components/catalog/CatalogGrid";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import type { PlacardProduct } from "@/components/ProductPlacard";
import classes from "./CatalogResults.module.css";

const PAGE_SIZE = 24;

type CatalogResultsProps = CatalogFilterValues & {
  onAddToCart: (product: PlacardProduct) => void;
};

const statusText = (count: number, hasMore: boolean, category?: string) => {
  if (count === 0) {
    return "No products found.";
  }
  const products = `${hasMore ? "the first " : ""}${count} product${count === 1 ? "" : "s"}`;
  return category ? `Showing ${products} in ${category}.` : `Showing ${products}.`;
};

const CatalogResults = ({ category, inStock, onAddToCart }: CatalogResultsProps) => {
  const { data, isPending, isPlaceholderData, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, refetch } =
    useInfiniteQuery({
      ...endpointInfiniteQuery(listProducts, { query: { category, inStock, limit: PAGE_SIZE } }),
      placeholderData: keepPreviousData
    });

  const products = data?.pages.flatMap(page => page.data) ?? [];

  const renderContent = () => {
    if (isPending) {
      return <PageLoader />;
    }
    if (!data) {
      return (
        <div role="alert">
          <MaloSays>Couldn't get the stock list. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (products.length === 0) {
      return (
        <MaloSays>
          {inStock ? "Nothing on that shelf right now. Come back after restocking." : "Nothing on that shelf. Try another."}
        </MaloSays>
      );
    }
    return (
      <CatalogGrid
        products={products}
        busy={isPlaceholderData}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        loadMoreFailed={isFetchNextPageError}
        onShowMore={() => void fetchNextPage()}
        onAddToCart={onAddToCart}
      />
    );
  };

  return (
    <>
      <Text role="status" className={classes.count}>
        {data && statusText(products.length, hasNextPage, category)}
      </Text>
      {renderContent()}
    </>
  );
};

export default CatalogResults;
