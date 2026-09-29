import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router";

import Layout from "@/components/Layout";
import HomePage from "@/pages/HomePage";
import NotFoundPage from "@/pages/NotFoundPage";
import PlaceholderPage from "@/pages/PlaceholderPage";
import { GuestOnly, RequireAdmin, RequireUser } from "@/routes/guards";

const AdminPage = lazy(() => import("@/pages/admin/AdminPage"));
const SignInPage = lazy(() => import("@/pages/auth/SignInPage"));
const SignUpPage = lazy(() => import("@/pages/auth/SignUpPage"));

const App = () => (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="products">
        <Route index element={<PlaceholderPage title="Products" />} />
        <Route path=":id" element={<PlaceholderPage title="Product" />} />
      </Route>
      <Route path="cart" element={<PlaceholderPage title="Cart" />} />
      <Route path="auth" element={<GuestOnly />}>
        <Route index element={<Navigate to="sign-in" replace />} />
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="sign-up" element={<SignUpPage />} />
      </Route>
      <Route element={<RequireUser />}>
        <Route path="orders" element={<PlaceholderPage title="Orders" />} />
        <Route path="orders/:id" element={<PlaceholderPage title="Order" />} />
      </Route>
      <Route path="admin" element={<RequireAdmin />}>
        <Route index element={<AdminPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes>
);

export default App;
