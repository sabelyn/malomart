import { Button } from "@mantine/core";
import type { ReactNode } from "react";
import { Link } from "react-router";

import { useCart } from "@/components/cart/CartProvider";
import MaloSays from "@/components/MaloSays";
import PageLoader from "@/components/PageLoader";
import RetryAlert from "@/components/RetryAlert";
import { malo, ui } from "@/copy";
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
        <MaloSays>{malo.cart.loadFailed}</MaloSays>
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
          {ui.cart.goShopping}
        </Button>
      </>
    );
  }
  if (!productsLoaded) {
    return productsFailed ? (
      <RetryAlert onRetry={onRetryProducts}>
        <MaloSays>{malo.cart.productsFailed}</MaloSays>
      </RetryAlert>
    ) : (
      <PageLoader />
    );
  }
  return children;
};

export default CartGate;
