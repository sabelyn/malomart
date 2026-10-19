import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentType } from "react";
import { lazy, Suspense } from "react";
import { Link, Route, Routes, useLocation } from "react-router";

import { sessionKey } from "@/api";
import { RequireUser } from "@/routes/guards";
import { useExitSession } from "@/routes/sessionExit";
import { customer, LocationDisplay, renderWithProviders } from "../../utils";

const SignInPage = () => {
  const { state } = useLocation() as { state: { notice?: string } | null };
  return <p>sign in form{state?.notice && `: ${state.notice}`}</p>;
};

const ExitButton = () => {
  const exitSession = useExitSession();
  return <button onClick={() => exitSession("/auth/sign-in", { notice: "Signed out everywhere." })}>Leave</button>;
};

const renderApp = (SignIn: ComponentType = SignInPage) =>
  renderWithProviders(
    <>
      <ExitButton />
      <Link to="/orders">Orders</Link>
      <Suspense>
        <Routes>
          <Route path="/auth/sign-in" element={<SignIn />} />
          <Route element={<RequireUser />}>
            <Route path="/orders" element={<p>orders list</p>} />
          </Route>
        </Routes>
      </Suspense>
      <LocationDisplay />
    </>,
    { route: "/orders", session: customer }
  );

const location = () => screen.getByTestId("location").textContent;

describe("useExitSession", () => {
  it("holds protected pages on a loader instead of bouncing to sign in while the exit loads", async () => {
    let finishLoading = () => {};
    const LazySignIn = lazy(
      () =>
        new Promise<{ default: ComponentType }>(resolve => {
          finishLoading = () => resolve({ default: SignInPage });
        })
    );
    const user = userEvent.setup();
    const { queryClient } = renderApp(LazySignIn);

    await user.click(screen.getByRole("button", { name: "Leave" }));

    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(location()).toBe("/orders");

    await act(() => {
      finishLoading();
      return Promise.resolve();
    });

    expect(await screen.findByText("sign in form: Signed out everywhere.")).toBeTruthy();
    expect(location()).toBe("/auth/sign-in");
  });

  it("stops holding once the exit lands so later visits to protected pages ask to sign in", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Leave" }));
    expect(await screen.findByText("sign in form: Signed out everywhere.")).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "Orders" }));

    expect(location()).toBe(`/auth/sign-in?${new URLSearchParams({ returnTo: "/orders" })}`);
    expect(screen.getByText("sign in form")).toBeTruthy();
  });
});
