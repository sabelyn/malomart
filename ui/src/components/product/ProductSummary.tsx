import { Text, Title } from "@mantine/core";
import type { ProductDto } from "@mm/lib/products";

import AddToCart from "@/components/cart/AddToCart";
import PriceTag from "@/components/product/PriceTag";
import { ui } from "@/copy";
import classes from "./ProductSummary.module.css";

type ProductSummaryProps = {
  product: ProductDto;
};

const ProductSummary = ({ product }: ProductSummaryProps) => (
  <div className={classes.summary}>
    <Title order={1}>{product.title}</Title>
    <Text className={classes.description}>{product.description}</Text>
    <PriceTag price={product.price} chudleyPrice={product.originalPrice ?? undefined} />
    <div className={classes.purchase}>
      <AddToCart product={product} size="lg" />
      <Text className={classes.stock}>{ui.product.stock(product.stockCount)}</Text>
    </div>
    {product.features.length > 0 && (
      <section aria-labelledby="features-heading" className={classes.features}>
        <Title order={2} id="features-heading" className={classes.featuresHeading}>
          {ui.product.featuresHeading}
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
