import { Container, Title } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { useRef } from "react";

import { useSession } from "@/api";
import cartClasses from "@/components/cart/cart.module.css";
import CartAdjustmentsAlert from "@/components/cart/CartAdjustmentsAlert";
import CartGate from "@/components/cart/CartGate";
import CartLine from "@/components/cart/CartLine";
import CartSummary from "@/components/cart/CartSummary";
import { useCartProducts } from "@/components/cart/useCartProducts";
import { malo, toasts, ui } from "@/copy";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "@/styles/pages.module.css";
import { notify } from "@/utils/notify";

const CartPage = () => {
  useDocumentTitle(ui.pageTitles.cart);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data: user } = useSession();
  const { cart, products, lines, subtotal, notices, isError, refetch } = useCartProducts();

  const remove = (product: ProductOverview) => {
    cart.remove(product.id);
    notify({ message: toasts.cart.removed(product.title) });
    headingRef.current?.focus();
  };

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1} ref={headingRef} tabIndex={-1}>
        {ui.cart.heading}
      </Title>
      {notices.length > 0 && <CartAdjustmentsAlert notices={notices} onClose={cart.clearAdjustments} />}
      <CartGate
        productsLoaded={!!products}
        productsFailed={isError}
        emptyMessage={malo.cart.empty}
        onRetryProducts={() => void refetch()}
      >
        <div className={cartClasses.layout}>
          <ul className={cartClasses.lines} aria-label={ui.common.items}>
            {lines.map(product => (
              <CartLine
                key={product.id}
                product={product}
                amount={cart.items[product.id]}
                onChangeAmount={amount => cart.setQuantity(product.id, amount)}
                onRemove={() => remove(product)}
              />
            ))}
          </ul>
          <CartSummary subtotal={subtotal} signedIn={!!user} />
        </div>
      </CartGate>
    </Container>
  );
};

export default CartPage;
