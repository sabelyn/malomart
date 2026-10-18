import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

import Layout from "@/components/Layout";
import CartPage from "@/pages/CartPage";
import CatalogPage from "@/pages/CatalogPage";
import NotFoundPage from "@/pages/NotFoundPage";
import ProductPage from "@/pages/ProductPage";
import { GuestOnly, RequireAdmin, RequireUser } from "@/routes/guards";

const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const AddressesSection = lazy(() => import("@/pages/account/AddressesSection"));
const AdminOrdersSection = lazy(() => import("@/pages/admin/AdminOrdersSection"));
const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const AdminProductsSection = lazy(() => import("@/pages/admin/AdminProductsSection"));
const CheckoutPage = lazy(() => import("@/pages/checkout/CheckoutPage"));
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
      <Route index element={<Navigate to="/products" replace />} />
      <Route path="products">
        <Route index element={<CatalogPage />} />
        <Route path=":id" element={<ProductPage />} />
      </Route>
      <Route path="cart" element={<CartPage />} />
      <Route path="auth" element={<GuestOnly />}>
        <Route index element={<Navigate to="sign-in" replace />} />
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="sign-up" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireUser />}>
        <Route path="account" element={<AccountPage />}>
          <Route index element={<ProfileSection />} />
          <Route path="addresses" element={<AddressesSection />} />
          <Route path="payment-methods" element={<PaymentMethodsSection />} />
          <Route path="orders" element={<OrdersSection />} />
        </Route>
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<Navigate to="/account/orders" replace />} />
        <Route path="orders/:id" element={<OrderDetailsPage />} />
        <Route path="orders/:id/placed" element={<OrderPlacedPage />} />
      </Route>
      <Route path="admin" element={<RequireAdmin />}>
        <Route element={<AdminPage />}>
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products" element={<AdminProductsSection />} />
          <Route path="orders" element={<AdminOrdersSection />} />
        </Route>
        <Route path="products/new" element={<ProductEditorPage />} />
        <Route path="products/:id" element={<ProductEditorPage />} />
        <Route path="orders/:id" element={<OrderDetailsPage backTo="/admin/orders" backLabel="All orders" />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default App;
