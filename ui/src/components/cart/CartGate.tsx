import { Button } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { useCart } from "@/components/cart/CartProvider";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { CATALOG_PATH } from "@/routes/paths";
import { isEmptyCart } from "@/utils/cartItems";

type CartGateProps = {
  productsLoaded: boolean;
  productsFailed: boolean;
  emptyMessage: string;
  children: ReactNode;
  onRetryProducts: () => void;
};

const CartGate = ({ productsLoaded, productsFailed, emptyMessage, children, onRetryProducts }: CartGateProps) => {
  const cart = useCart();

  if (cart.loadFailed) {
    return (
      <RetryAlert onRetry={cart.retryLoad}>
        <MaloSays>Lost track of your cart. Not my fault.</MaloSays>
      </RetryAlert>
    );
  }
  if (!cart.ready) {
    return <PageLoader />;
  }
  if (isEmptyCart(cart.items)) {
    return (
      <>
        <MaloSays>{emptyMessage}</MaloSays>
        <Button component={Link} to={CATALOG_PATH} mt="xl">
          Go shopping
        </Button>
      </>
    );
  }
  if (!productsLoaded) {
    return productsFailed ? (
      <RetryAlert onRetry={onRetryProducts}>
        <MaloSays>Couldn't find what's in your cart. Probably the shelves.</MaloSays>
      </RetryAlert>
    ) : (
      <PageLoader />
    );
  }
  return children;
};

export default CartGate;
