import { Button, NativeSelect, Text, Title, VisuallyHidden } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { Link } from "react-router";

import { formatRupees } from "@/components/product/PriceTag";
import { productImageSrc } from "@/components/product/productDisplay";
import { productPath } from "@/routes/paths";
import classes from "./cart.module.css";

const THUMBNAIL_WIDTH = 320;
const MAX_SELECTABLE = 99;
const LOW_STOCK = 3;

type CartLineProps = {
  product: ProductOverview;
  amount: number;
  onChangeAmount: (amount: number) => void;
  onRemove: () => void;
};

const amountOptions = (stockCount: number, amount: number) =>
  Array.from({ length: Math.max(Math.min(stockCount, MAX_SELECTABLE), amount) }, (_, i) => String(i + 1));

const CartLine = ({ product, amount, onChangeAmount, onRemove }: CartLineProps) => {
  const headingId = `cart-line-${product.id}`;

  return (
    <li className={classes.line}>
      {product.thumbnailKey ? (
        <img src={productImageSrc(product.thumbnailKey, THUMBNAIL_WIDTH)} alt="" className={classes.image} />
      ) : (
        <div className={classes.image} />
      )}
      <div className={classes.details}>
        <Title order={2} id={headingId} className={classes.title}>
          <Link to={productPath(product.id)} className={classes.link}>
            {product.title}
          </Link>
        </Title>
        <Text className={classes.each}>{formatRupees(product.price)} rupees each</Text>
        {product.stockCount <= LOW_STOCK && <Text className={classes.stock}>Only {product.stockCount} in stock.</Text>}
      </div>
      <div className={classes.controls}>
        <NativeSelect
          className={classes.amount}
          label="Quantity"
          aria-label={`Quantity of ${product.title}`}
          data={amountOptions(product.stockCount, amount)}
          value={String(amount)}
          onChange={event => onChangeAmount(Number(event.currentTarget.value))}
        />
        <Button variant="subtle" color="gilt" onClick={onRemove}>
          Remove <VisuallyHidden>{product.title}</VisuallyHidden>
        </Button>
      </div>
      <Text className={classes.lineTotal}>
        <span aria-hidden="true">{formatRupees(product.price * amount)}</span>
        <VisuallyHidden>{formatRupees(product.price * amount)} rupees total</VisuallyHidden>
      </Text>
    </li>
  );
};

export default CartLine;
