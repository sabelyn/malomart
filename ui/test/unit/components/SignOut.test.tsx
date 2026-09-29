import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import { sessionKey } from "@/api";
import Layout from "@/components/Layout";
import { RequireUser } from "@/routes/guards";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../utils";

const app = (
  <>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<p>home page</p>} />
        <Route path="auth/sign-in" element={<p>sign in form</p>} />
        <Route element={<RequireUser />}>
          <Route path="orders" element={<p>orders list</p>} />
        </Route>
      </Route>
    </Routes>
    <LocationDisplay />
  </>
);

const signOutButton = () => screen.getByRole("button", { name: "Sign out" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sign out", () => {
  it("is only offered to signed-in users", () => {
    stubApi({});
    renderWithProviders(app, { session: null });

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  });

  it("signs out from a protected page and lands on the home page, not sign in", async () => {
    const fetch = stubApi({ "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { route: "/orders", session: customer });

    await user.click(signOutButton());

    expect(await screen.findByText("home page")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(requestsTo(fetch, "POST /api/auth/sign-out")).toHaveLength(1);
  });

  it("moves focus to the main content even when already on the home page", async () => {
    stubApi({ "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderWithProviders(app, { session: customer });

    await user.click(signOutButton());

    await screen.findByRole("link", { name: "Sign in" });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("drops cached data from the signed-in session", async () => {
    stubApi({ "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { session: customer });
    queryClient.setQueryData(["api", "orders", "listOrders", {}], [{ id: "order-1" }]);

    await user.click(signOutButton());
    await screen.findByRole("link", { name: "Sign in" });

    expect(queryClient.getQueryData(["api", "orders", "listOrders", {}])).toBeUndefined();
  });

  it("keeps the user signed in and says so when sign out fails", async () => {
    stubApi({ "POST /api/auth/sign-out": () => json(500, { message: "boom" }) });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { route: "/orders", session: customer });

    await user.click(signOutButton());

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't sign you out. Try again.");
    expect(screen.getByText("orders list")).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toEqual(customer);
  });
});
