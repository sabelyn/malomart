import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

import Layout from "@/components/Layout";
import CartPage from "@/pages/CartPage";
import CatalogPage from "@/pages/CatalogPage";
import NotFoundPage from "@/pages/NotFoundPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import ProductPage from "@/pages/ProductPage";
import { GuestOnly, RequireAdmin, RequireUser } from "@/routes/guards";

const AccountPage = lazy(() => import("@/pages/account/AccountPage"));
const AccountPlaceholder = lazy(() => import("@/pages/account/AccountPlaceholder"));
const AddressesSection = lazy(() => import("@/pages/account/AddressesSection"));
const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const CheckoutPage = lazy(() => import("@/pages/checkout/CheckoutPage"));
const OrderPlacedPage = lazy(() => import("@/pages/orders/OrderPlacedPage"));
const PaymentMethodsSection = lazy(() => import("@/pages/account/PaymentMethodsSection"));
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
          <Route path="orders" element={<AccountPlaceholder title="Orders" />} />
        </Route>
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="orders" element={<Navigate to="/account/orders" replace />} />
        <Route path="orders/:id" element={<PlaceholderPage title="Order" />} />
        <Route path="orders/:id/placed" element={<OrderPlacedPage />} />
      </Route>
      <Route path="admin" element={<RequireAdmin />}>
        <Route index element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default App;
