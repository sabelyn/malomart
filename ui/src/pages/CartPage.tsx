import { Button, Container, Title } from "@mantine/core";
import type { ProductOverview } from "@mm/lib/products";
import { useRef } from "react";
import { Link } from "react-router";

import { useSession } from "@/api";
import { isEmptyCart } from "@/cart/cartItems";
import { useCartProducts } from "@/cart/useCartProducts";
import cartClasses from "@/components/cart/cart.module.css";
import CartAdjustmentsAlert from "@/components/cart/CartAdjustmentsAlert";
import CartLine from "@/components/cart/CartLine";
import CartSummary from "@/components/cart/CartSummary";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { notify } from "@/notifications/notify";
import classes from "./pages.module.css";

const CartPage = () => {
  useDocumentTitle("Cart");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { data: user } = useSession();
  const { cart, products, lines, subtotal, notices, isError, refetch } = useCartProducts();
  const { items, ready } = cart;

  const remove = (product: ProductOverview) => {
    cart.remove(product.id);
    notify({ message: `Removed ${product.title} from your cart.` });
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
      {notices.length > 0 && <CartAdjustmentsAlert notices={notices} onClose={cart.clearAdjustments} />}
      {renderContent()}
    </Container>
  );
};

export default CartPage;
