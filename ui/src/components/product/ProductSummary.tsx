import { Button, Text, Title } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";

import PriceTag from "@/components/product/PriceTag";
import { stockLine } from "@/components/product/productDisplay";
import classes from "./ProductSummary.module.css";

type ProductSummaryProps = {
  product: ProductDto;
  onAddToCart: (product: ProductDto) => void;
};

const ProductSummary = ({ product, onAddToCart }: ProductSummaryProps) => (
  <div className={classes.summary}>
    <Title order={1}>{product.title}</Title>
    <Text className={classes.description}>{product.description}</Text>
    <PriceTag price={product.price} chudleyPrice={product.originalPrice ?? undefined} />
    <div className={classes.purchase}>
      <Button size="lg" disabled={product.stockCount === 0} onClick={() => onAddToCart(product)}>
        Add to cart
      </Button>
      <Text className={classes.stock}>{stockLine(product.stockCount)}</Text>
    </div>
    {product.features.length > 0 && (
      <section aria-labelledby="features-heading" className={classes.features}>
        <Title order={2} id="features-heading" className={classes.featuresHeading}>
          What it does
        </Title>
        <ul>
          {product.features.map(feature => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>
    )}
  </div>
);

export default ProductSummary;
