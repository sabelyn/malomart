import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

import Layout from "@/components/layout/Layout";
import { ui } from "@/copy";
import CartPage from "@/pages/CartPage";
import CatalogPage from "@/pages/CatalogPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProductPage from "@/pages/ProductPage";
import { GuestOnly, RequireAdmin, RequireUser } from "@/routes/guards";
import {
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_ORDERS_PATH,
  ACCOUNT_PATH,
  ACCOUNT_PAYMENT_METHODS_PATH,
  ADMIN_NEW_PRODUCT_PATH,
  ADMIN_ORDER_ROUTE,
  ADMIN_ORDERS_PATH,
  ADMIN_PATH,
  ADMIN_PRODUCT_ROUTE,
  ADMIN_PRODUCTS_PATH,
  AUTH_PATH,
  CART_PATH,
  CATALOG_PATH,
  CHECKOUT_PATH,
  ORDER_PLACED_ROUTE,
  ORDER_ROUTE,
  ORDERS_PATH,
  PRODUCT_ROUTE,
  SIGN_IN_PATH,
  SIGN_UP_PATH
} from "@/routes/paths";

const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const AddressesSection = lazy(() => import("@/pages/account/AddressesSection"));
const AdminOrdersSection = lazy(() => import("@/pages/admin/AdminOrdersSection"));
const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const AdminProductsSection = lazy(() => import("@/pages/admin/AdminProductsSection"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderDetailsPage = lazy(() => import("@/pages/orders/OrderDetailsPage"));
const OrderPlacedPage = lazy(() => import("@/pages/orders/OrderPlacedPage"));
const OrdersSection = lazy(() => import("@/pages/account/OrdersSection"));
const PaymentMethodsSection = lazy(() => import("@/pages/account/PaymentMethodsSection"));
const ProductEditorPage = lazy(() => import("@/pages/admin/ProductEditorPage"));
const ProfileSection = lazy(() => import("@/pages/account/ProfileSection"));
const SignInPage = lazy(() => import("@/pages/auth/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/auth/SignUpPage"));

const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Navigate to={CATALOG_PATH} replace />} />
      <Route path={CATALOG_PATH}>
        <Route index element={<CatalogPage />} />
        <Route path={PRODUCT_ROUTE} element={<ProductPage />} />
      </Route>
      <Route path={CART_PATH} element={<CartPage />} />
      <Route path={AUTH_PATH} element={<GuestOnly />}>
        <Route index element={<Navigate to={SIGN_IN_PATH} replace />} />
        <Route path={SIGN_IN_PATH} element={<SignInPage />} />
        <Route path={SIGN_UP_PATH} element={<SignUpPage />} />
      </Route>
      <Route element={<RequireUser />}>
        <Route path={ACCOUNT_PATH} element={<AccountPage />}>
          <Route index element={<ProfileSection />} />
          <Route path={ACCOUNT_ADDRESSES_PATH} element={<AddressesSection />} />
          <Route path={ACCOUNT_PAYMENT_METHODS_PATH} element={<PaymentMethodsSection />} />
          <Route path={ACCOUNT_ORDERS_PATH} element={<OrdersSection />} />
        </Route>
        <Route path={CHECKOUT_PATH} element={<CheckoutPage />} />
        <Route path={ORDERS_PATH} element={<Navigate to={ACCOUNT_ORDERS_PATH} replace />} />
        <Route path={ORDER_ROUTE} element={<OrderDetailsPage />} />
        <Route path={ORDER_PLACED_ROUTE} element={<OrderPlacedPage />} />
      </Route>
      <Route path={ADMIN_PATH} element={<RequireAdmin />}>
        <Route element={<AdminPage />}>
          <Route index element={<Navigate to={ADMIN_PRODUCTS_PATH} replace />} />
          <Route path={ADMIN_PRODUCTS_PATH} element={<AdminProductsSection />} />
          <Route path={ADMIN_ORDERS_PATH} element={<AdminOrdersSection />} />
        </Route>
        <Route path={ADMIN_NEW_PRODUCT_PATH} element={<ProductEditorPage />} />
        <Route path={ADMIN_PRODUCT_ROUTE} element={<ProductEditorPage />} />
        <Route
          path={ADMIN_ORDER_ROUTE}
          element={<OrderDetailsPage backTo={ADMIN_ORDERS_PATH} backLabel={ui.orders.allOrders} />}
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default App;
