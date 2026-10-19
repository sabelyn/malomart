import { Group, Text, Title } from "@mantine/core";
import type { Product, ProductOverview } from "@mm/lib/products";
import { Link } from "react-router";

import AddToCart from "@/components/cart/AddToCart";
import PriceTag from "@/components/product/PriceTag";
import { percentOff, productImageSrc } from "@/components/product/productDisplay";
import SaleSticker from "@/components/product/SaleSticker";
import { ui } from "@/copy";
import { productPath } from "@/routes/paths";
import classes from "./ProductPlacard.module.css";

export type PlacardProduct = ProductOverview & Partial<Pick<Product, "category" | "description">>;

type ProductPlacardProps = {
  product: PlacardProduct;
  hideCategory?: boolean;
};

const THUMBNAIL_WIDTH = 320;

const ProductPlacard = ({ product, hideCategory }: ProductPlacardProps) => {
  const originalPrice = product.originalPrice ?? undefined;
  const src = product.thumbnailKey && productImageSrc(product.thumbnailKey, THUMBNAIL_WIDTH);

  return (
    <article className={classes.placard} aria-labelledby={`product-${product.id}`}>
      <SaleSticker percentOff={percentOff(product.price, originalPrice)} className={classes.sticker} />
      <div className={classes.heading}>
        {src ? <img src={src} alt="" loading="lazy" className={classes.image} /> : <div className={classes.image} />}
        <div>
          {product.category && !hideCategory && <Text className={classes.category}>{product.category}</Text>}
          <Title order={3} id={`product-${product.id}`} className={classes.title}>
            <Link to={productPath(product.id)} className={classes.link}>
              {product.title}
            </Link>
          </Title>
        </div>
      </div>
      {product.description && <Text className={classes.description}>{product.description}</Text>}
      <div className={classes.footer}>
        <PriceTag price={product.price} chudleyPrice={originalPrice} />
        <Group justify="space-between" align="center">
          <Text className={classes.stock}>{ui.product.stock(product.stockCount)}</Text>
          <AddToCart product={product} className={classes.action} describedBy={`product-${product.id}`} />
        </Group>
      </div>
    </article>
  );
};

export default ProductPlacard;
