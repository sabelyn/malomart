import { Button, Group, Text, Title } from "@mantine/core";
import type { Product } from "@mm/lib/products";

import PriceTag from "@/components/PriceTag";
import classes from "./ProductPlacard.module.css";

type ProductPlacardProps = {
  product: Product;
  image?: string;
  chudleyPrice?: number;
  onAddToCart: (product: Product) => void;
};

const stockLine = (inStock: number) => {
  if (inStock === 0) {
    return "Sold out. Should've been faster.";
  }
  if (inStock <= 3) {
    return `${inStock} left. Decide.`;
  }
  return `${inStock} in stock.`;
};

const ProductPlacard = ({ product, image, chudleyPrice, onAddToCart }: ProductPlacardProps) => {
  const percentOff = chudleyPrice ? Math.floor((1 - product.price / chudleyPrice) * 100) : 0;

  return (
    <article className={classes.placard} aria-labelledby={`product-${product.id}`}>
      {percentOff > 0 && <p className={classes.sticker}>{percentOff}% off? Why not!</p>}
      <div className={classes.heading}>
        {image && <img src={image} alt="" className={classes.image} />}
        <div>
          <Text className={classes.category}>{product.category}</Text>
          <Title order={3} id={`product-${product.id}`} className={classes.title}>
            {product.title}
          </Title>
        </div>
      </div>
      <Text className={classes.description}>{product.description}</Text>
      <PriceTag price={product.price} chudleyPrice={chudleyPrice} />
      <Group justify="space-between" align="center">
        <Text className={classes.stock}>{stockLine(product.inStock)}</Text>
        <Button disabled={product.inStock === 0} onClick={() => onAddToCart(product)}>
          Add to cart
        </Button>
      </Group>
    </article>
  );
};

export default ProductPlacard;
