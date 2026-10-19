import { Button, Group, SimpleGrid, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

import type { PlacardProduct } from "@/components/product/ProductPlacard";
import ProductPlacard from "@/components/product/ProductPlacard";
import classes from "./CatalogGrid.module.css";

type CatalogGridProps = {
  products: PlacardProduct[];
  busy: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onShowMore: () => void;
  hideCategory?: boolean;
};

const CatalogGrid = ({
  products,
  busy,
  hasMore,
  loadingMore,
  loadMoreFailed,
  onShowMore,
  hideCategory
}: CatalogGridProps) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState<number>();

  useEffect(() => {
    if (focusIndex === undefined || products.length <= focusIndex) {
      return;
    }
    gridRef.current?.querySelectorAll<HTMLAnchorElement>("article a")[focusIndex]?.focus();
    setFocusIndex(undefined);
  }, [focusIndex, products.length]);

  const showMore = () => {
    setFocusIndex(products.length);
    onShowMore();
  };

  return (
    <>
      <SimpleGrid
        ref={gridRef}
        cols={{ base: 1, sm: 2, md: 3 }}
        spacing="xl"
        verticalSpacing="xl"
        aria-busy={busy}
        className={classes.grid}
      >
        {products.map(product => (
          <ProductPlacard key={product.id} product={product} hideCategory={hideCategory} />
        ))}
      </SimpleGrid>
      {hasMore && (
        <Group justify="center" mt="xl">
          <Button variant="outline" onClick={showMore} loading={loadingMore}>
            Show more
          </Button>
        </Group>
      )}
      {loadMoreFailed && (
        <Text role="alert" ta="center" mt="md" c="red.4">
          Couldn't load more. Try again.
        </Text>
      )}
    </>
  );
};

export default CatalogGrid;
