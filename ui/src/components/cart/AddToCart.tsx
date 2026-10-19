import type { ButtonProps } from "@mantine/core";
import { Button, Text } from "@mantine/core";
import { useEffect, useRef } from "react";

import type { CartProduct } from "@/components/cart/CartProvider";
import { useCart } from "@/components/cart/CartProvider";
import classes from "./AddToCart.module.css";

type AddToCartProps = {
  product: CartProduct;
  size?: ButtonProps["size"];
  className?: string;
  describedBy?: string;
};

const AddToCart = ({ product, size, className, describedBy }: AddToCartProps) => {
  const { items, ready, add, subtract } = useCart();
  const amount = items[product.id] ?? 0;
  const inCart = amount > 0;
  const atStock = amount >= product.stockCount;
  const addRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const moveFocus = useRef(false);

  useEffect(() => {
    if (!moveFocus.current) {
      return;
    }
    moveFocus.current = false;
    (inCart ? moreRef : addRef).current?.focus();
  }, [inCart]);

  const change = (apply: (product: CartProduct) => void, togglesInCart: boolean) => {
    moveFocus.current = ready && togglesInCart;
    apply(product);
  };

  if (!inCart) {
    return (
      <Button
        ref={addRef}
        size={size}
        className={className}
        aria-describedby={describedBy}
        disabled={product.stockCount === 0}
        onClick={() => change(add, true)}
      >
        Add to cart
      </Button>
    );
  }

  return (
    <div className={`${classes.stepper} ${className ?? ""}`}>
      <Button
        size={size}
        variant="outline"
        aria-label={`Remove one ${product.title}`}
        onClick={() => change(subtract, amount === 1)}
      >
        −
      </Button>
      <Text className={classes.amount}>{amount} in cart</Text>
      <Button
        ref={moreRef}
        size={size}
        variant="outline"
        aria-label={`Add one more ${product.title}`}
        aria-disabled={atStock}
        data-disabled={atStock || undefined}
        onClick={() => change(add, false)}
      >
        +
      </Button>
    </div>
  );
};

export default AddToCart;
