import { generatePath } from "react-router";

export const HOME_PATH = "/";

export const CATALOG_PATH = "/products";
export const PRODUCT_ROUTE = "/products/:id";
export const CART_PATH = "/cart";
export const CHECKOUT_PATH = "/checkout";
export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const CREDITS_PATH = "/credits";

export const AUTH_PATH = "/auth";
export const SIGN_IN_PATH = "/auth/sign-in";
export const SIGN_UP_PATH = "/auth/sign-up";

export const ACCOUNT_PATH = "/account";
export const ACCOUNT_ADDRESSES_PATH = "/account/addresses";
export const ACCOUNT_PAYMENT_METHODS_PATH = "/account/payment-methods";
export const ACCOUNT_ORDERS_PATH = "/account/orders";

export const ORDERS_PATH = "/orders";
export const ORDER_ROUTE = "/orders/:id";
export const ORDER_PLACED_ROUTE = "/orders/:id/placed";

export const ADMIN_PATH = "/admin";
export const ADMIN_PRODUCTS_PATH = "/admin/products";
export const ADMIN_NEW_PRODUCT_PATH = "/admin/products/new";
export const ADMIN_PRODUCT_ROUTE = "/admin/products/:id";
export const ADMIN_ORDERS_PATH = "/admin/orders";
export const ADMIN_ORDER_ROUTE = "/admin/orders/:id";

export const productPath = (id: string) => generatePath(PRODUCT_ROUTE, { id });

export const categoryPath = (category: string) => `${CATALOG_PATH}?${new URLSearchParams({ category })}`;

export const orderPath = (id: string) => generatePath(ORDER_ROUTE, { id });

export const orderPlacedPath = (id: string) => generatePath(ORDER_PLACED_ROUTE, { id });

export const adminProductPath = (id: string) => generatePath(ADMIN_PRODUCT_ROUTE, { id });

export const adminOrderPath = (id: string) => generatePath(ADMIN_ORDER_ROUTE, { id });

export type SignInState = {
  email?: string;
  notice?: string;
};

const withReturnTo = (path: string, returnTo?: string) =>
  returnTo && returnTo !== HOME_PATH && !returnTo.startsWith(AUTH_PATH)
    ? `${path}?${new URLSearchParams({ returnTo })}`
    : path;

export const signInPath = (returnTo?: string) => withReturnTo(SIGN_IN_PATH, returnTo);

export const signUpPath = (returnTo?: string) => withReturnTo(SIGN_UP_PATH, returnTo);
