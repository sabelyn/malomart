import { Button, Group, Text, Title, VisuallyHidden } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { productImageSrc } from "@/components/product/productDisplay";
import { alerts, ui } from "@/copy";
import { adminProductPath } from "@/routes/paths";
import classes from "./admin.module.css";

const THUMBNAIL_WIDTH = 320;

type AdminProductListProps = {
  products: ProductOverview[];
  busy: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  onShowMore: () => void;
  onDelete: (product: ProductOverview) => void;
};

const AdminProductList = ({
  products,
  busy,
  hasMore,
  loadingMore,
  loadMoreFailed,
  onShowMore,
  onDelete
}: AdminProductListProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const [focusIndex, setFocusIndex] = useState<number>();

  useEffect(() => {
    if (focusIndex === undefined || products.length <= focusIndex) {
      return;
    }
    listRef.current?.querySelectorAll<HTMLAnchorElement>(`.${classes.productLink}`)[focusIndex]?.focus();
    setFocusIndex(undefined);
  }, [focusIndex, products.length]);

  const showMore = () => {
    setFocusIndex(products.length);
    onShowMore();
  };

  return (
    <>
      <ul ref={listRef} aria-busy={busy} className={classes.productList}>
        {products.map(product => {
          const { id, title, category, price, originalPrice, stockCount, thumbnailKey } = product;
          return (
            <li key={id} className={classes.productRow}>
              {thumbnailKey ? (
                <img
                  src={productImageSrc(thumbnailKey, THUMBNAIL_WIDTH)}
                  alt=""
                  loading="lazy"
                  className={classes.thumb}
                />
              ) : (
                <span className={classes.noThumb} />
              )}
              <div>
                <Title order={3} className={classes.productTitle}>
                  <Link to={adminProductPath(id)} className={classes.productLink}>
                    {title}
                  </Link>
                </Title>
                <Text className={classes.productMeta}>
                  {category}. {ui.admin.priceLabel(price, originalPrice)}.{" "}
                  <span className={stockCount === 0 ? classes.soldOut : undefined}>
                    {ui.admin.stockLabel(stockCount)}.
                  </span>
                  {!thumbnailKey && ` ${ui.admin.noImages}`}
                </Text>
              </div>
              <Button variant="subtle" color="red.4" size="compact-sm" onClick={() => onDelete(product)}>
                {ui.common.delete} <VisuallyHidden>{title}</VisuallyHidden>
              </Button>
            </li>
          );
        })}
      </ul>
      {hasMore && (
        <Group justify="center" mt="xl">
          <Button variant="outline" onClick={showMore} loading={loadingMore}>
            {ui.common.showMore}
          </Button>
        </Group>
      )}
      {loadMoreFailed && (
        <Text role="alert" ta="center" mt="md" c="red.4">
          {alerts.loadMoreFailed}
        </Text>
      )}
    </>
  );
};

export default AdminProductList;
