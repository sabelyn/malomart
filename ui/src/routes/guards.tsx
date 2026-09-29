import { safeReturnTo } from "@mm/lib/auth";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation, useSearchParams } from "react-router";

import { sessionQuery, useSession } from "@/api";
import PageLoader from "@/components/PageLoader";
import NotFoundPage from "@/pages/NotFoundPage";
import { signInPath } from "./paths";

const useRequiredSession = () => useQuery({ ...sessionQuery, throwOnError: true });

const useCurrentPath = () => {
  const { pathname, search, hash } = useLocation();
  return `${pathname}${search}${hash}`;
};

export const RequireUser = () => {
  const { data: user, isPending } = useRequiredSession();
  const currentPath = useCurrentPath();

  if (isPending) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to={signInPath(currentPath)} replace />;
  }
  return <Outlet />;
};

export const RequireAdmin = () => {
  const { data: user, isPending } = useRequiredSession();
  const currentPath = useCurrentPath();

  if (isPending) {
    return <PageLoader />;
  }
  if (!user) {
    return <Navigate to={signInPath(currentPath)} replace />;
  }
  if (!user.isAdmin) {
    return <NotFoundPage />;
  }
  return <Outlet />;
};

export const GuestOnly = () => {
  const { data: user, isPending } = useSession();
  const [searchParams] = useSearchParams();

  if (isPending) {
    return <PageLoader />;
  }
  if (user) {
    return <Navigate to={safeReturnTo(searchParams.get("returnTo"))} replace />;
  }
  return <Outlet />;
};
