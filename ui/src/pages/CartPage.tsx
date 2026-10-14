import { Alert, Button, Container, Title } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { getProductsByIds } from "@mm/lib/products";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

import { endpointQuery, useSession } from "@/api";
import { isEmptyCart, stockAdjustments } from "@/cart/cartItems";
import { useCart } from "@/cart/CartProvider";
import cartClasses from "@/components/cart/cart.module.css";
import CartLine from "@/components/cart/CartLine";
import CartSummary from "@/components/cart/CartSummary";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import classes from "./pages.module.css";

const byTitle = (a: ProductOverview, b: ProductOverview) => a.title.localeCompare(b.title);

const adjustmentNotices = (adjustments: Record<string, number>, products: Map<string, ProductOverview>) => {
  const notices: string[] = [];
  let missing = 0;
  for (const [id, amount] of Object.entries(adjustments)) {
    const product = products.get(id);
    if (!product) {
      missing++;
    } else if (amount === 0) {
      notices.push(`${product.title} sold out, so I took it out.`);
    } else {
      notices.push(`${product.title}: only ${amount} left, so that's what you get.`);
    }
  }
  if (missing === 1) {
    notices.push("Something in your cart isn't sold anymore, so I took it out.");
  } else if (missing > 1) {
    notices.push(`${missing} things in your cart aren't sold anymore, so I took them out.`);
  }
  return notices;
};

const CartPage = () => {
  useDocumentTitle("Cart");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data: user } = useSession();
  const cart = useCart();
  const { items, ready, adjustments, adjust } = cart;

  const ids = [...new Set([...Object.keys(items), ...Object.keys(adjustments)])].sort();
  const {
    data: products,
    isPlaceholderData,
    isError,
    refetch
  } = useQuery({
    ...endpointQuery(getProductsByIds, { query: { ids } }),
    enabled: ready && ids.length > 0,
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (!ready || !products || isPlaceholderData) {
      return;
    }
    const changes = stockAdjustments(items, products);
    if (!isEmptyCart(changes)) {
      adjust(changes);
    }
  }, [ready, products, isPlaceholderData, items, adjust]);

  const productsById = new Map((products ?? []).map(product => [product.id, product]));
  const lines = (products ?? []).filter(product => items[product.id] !== undefined).sort(byTitle);
  const subtotal = lines.reduce((total, product) => total + product.price * items[product.id], 0);
  const notices = adjustmentNotices(adjustments, productsById);

  const remove = (product: ProductOverview) => {
    cart.remove(product.id);
    cart.announce(`Removed ${product.title} from your cart.`);
    headingRef.current?.focus();
  };

  const renderContent = () => {
    if (cart.loadFailed) {
      return (
        <div role="alert">
          <MaloSays>Lost track of your cart. Not my fault.</MaloSays>
          <Button mt="lg" variant="outline" onClick={cart.retryLoad}>
            Try again
          </Button>
        </div>
      );
    }
    if (!ready) {
      return <PageLoader />;
    }
    if (isEmptyCart(items)) {
      return (
        <>
          <MaloSays>Empty. That's not how a store works.</MaloSays>
          <Button component={Link} to="/products" mt="xl">
            Go shopping
          </Button>
        </>
      );
    }
    if (isError && !products) {
      return (
        <div role="alert">
          <MaloSays>Couldn't find what's in your cart. Probably the shelves.</MaloSays>
          <Button mt="lg" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      );
    }
    if (!products) {
      return <PageLoader />;
    }
    return (
      <div className={cartClasses.layout}>
        <ul className={cartClasses.lines} aria-label="Items">
          {lines.map(product => (
            <CartLine
              key={product.id}
              product={product}
              amount={items[product.id]}
              onChangeAmount={amount => cart.setQuantity(product.id, amount)}
              onRemove={() => remove(product)}
            />
          ))}
        </ul>
        <CartSummary count={cart.count} subtotal={subtotal} signedIn={!!user} />
      </div>
    );
  };

  return (
    <Container size="lg" className={classes.page}>
      <Title order={1} ref={headingRef} tabIndex={-1}>
        Your cart
      </Title>
      {notices.length > 0 && (
        <Alert
          mt="xl"
          variant="light"
          color="gilt"
          title="I fixed your cart"
          withCloseButton
          closeButtonLabel="Dismiss"
          onClose={cart.clearAdjustments}
        >
          <ul className={cartClasses.notices}>
            {notices.map(notice => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </Alert>
      )}
      {cart.saveFailed && (
        <Alert mt="xl" variant="light" color="red">
          Couldn't save that change. Your cart is back to how it was.
        </Alert>
      )}
      {renderContent()}
    </Container>
  );
};

export default CartPage;
