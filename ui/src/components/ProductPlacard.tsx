import { Button, Group, Text, Title } from "@mantine/core";
import { imageVariantKey } from "@mm/lib/products";
import type { Product, ProductOverview } from "@mm/lib/products";
import { Link } from "react-router";

import PriceTag from "@/components/PriceTag";
import classes from "./ProductPlacard.module.css";

export type PlacardProduct = ProductOverview & Partial<Pick<Product, "category" | "description">>;

type ProductPlacardProps = {
  product: PlacardProduct;
  image?: string;
  onAddToCart: (product: PlacardProduct) => void;
};

const THUMBNAIL_WIDTH = 320;

const stockLine = (inStock: number) => {
  if (inStock === 0) {
    return "Sold out. Should've been faster.";
  }
  if (inStock <= 3) {
    return `${inStock} left. Decide.`;
  }
  return `${inStock} in stock.`;
};

const ProductPlacard = ({ product, image, onAddToCart }: ProductPlacardProps) => {
  const originalPrice = product.originalPrice ?? undefined;
  const percentOff = originalPrice ? Math.floor((1 - product.price / originalPrice) * 100) : 0;
  const src = image ?? (product.thumbnailKey && `/${imageVariantKey(product.thumbnailKey, THUMBNAIL_WIDTH)}`);

  return (
    <article className={classes.placard} aria-labelledby={`product-${product.id}`}>
      {percentOff > 0 && <p className={classes.sticker}>{percentOff}% off? Why not!</p>}
      <div className={classes.heading}>
        {src ? <img src={src} alt="" loading="lazy" className={classes.image} /> : <div className={classes.image} />}
        <div>
          {product.category && <Text className={classes.category}>{product.category}</Text>}
          <Title order={3} id={`product-${product.id}`} className={classes.title}>
            <Link to={`/products/${product.id}`} className={classes.link}>
              {product.title}
            </Link>
          </Title>
        </div>
      </div>
      {product.description && <Text className={classes.description}>{product.description}</Text>}
      <div className={classes.footer}>
        <PriceTag price={product.price} chudleyPrice={originalPrice} />
        <Group justify="space-between" align="center">
          <Text className={classes.stock}>{stockLine(product.inStock)}</Text>
          <Button
            className={classes.action}
            aria-describedby={`product-${product.id}`}
            disabled={product.inStock === 0}
            onClick={() => onAddToCart(product)}
          >
            Add to cart
          </Button>
        </Group>
      </div>
    </article>
  );
};

export default ProductPlacard;
