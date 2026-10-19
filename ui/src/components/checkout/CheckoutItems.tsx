import { Text, Title, VisuallyHidden } from "@mantine/core";
import { Link } from "react-router";

import { productImageSrc } from "@/components/product/productDisplay";
import { formatRupees, ui } from "@/copy";
import { productPath } from "@/routes/paths";
import classes from "./checkout.module.css";

const THUMBNAIL_WIDTH = 320;

export type CheckoutItem = {
  id: string;
  title: string;
  thumbnailKey?: string | null;
  amount: number;
  pricePerUnit: number;
};

type CheckoutItemsProps = {
  items: CheckoutItem[];
};

const CheckoutItems = ({ items }: CheckoutItemsProps) => (
  <ul className={classes.items} aria-label={ui.common.items}>
    {items.map(({ id, title, thumbnailKey, amount, pricePerUnit }) => (
      <li key={id} className={classes.item}>
        {thumbnailKey ? (
          <img src={productImageSrc(thumbnailKey, THUMBNAIL_WIDTH)} alt="" className={classes.itemImage} />
        ) : (
          <div className={classes.itemImage} />
        )}
        <div>
          <Title order={3} className={classes.itemTitle}>
            <Link to={productPath(id)}>{title}</Link>
          </Title>
          <Text className={classes.itemMeta}>{ui.checkout.itemMeta(amount, pricePerUnit)}</Text>
        </div>
        <Text className={classes.itemTotal}>
          <span aria-hidden="true">{formatRupees(amount * pricePerUnit)}</span>
          <VisuallyHidden>{ui.common.rupeesTotal(amount * pricePerUnit)}</VisuallyHidden>
        </Text>
      </li>
    ))}
  </ul>
);

export default CheckoutItems;
