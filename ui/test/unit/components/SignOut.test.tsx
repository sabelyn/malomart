import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { sessionKey } from "@/api";
import Layout from "@/components/Layout";
import { RequireUser } from "@/routes/guards";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../utils";

const CUSTOMER_ID = "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d";
const PRODUCT_ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";

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

const customerHandlers = {
  "GET /api/customers": () =>
    json(200, { id: CUSTOMER_ID, defaultAddress: null, defaultPaymentMethod: null, cart: { [PRODUCT_ID]: 2 } })
};

const signOutButton = () => screen.getByRole("button", { name: "Sign out" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sign out", () => {
  it("is only offered to signed-in users", () => {
    stubApi({});
    renderWithProviders(app, { session: null, withCart: true });

    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
  });

  it("signs out from a protected page and lands on the home page, not sign in", async () => {
    const fetch = stubApi({
      ...customerHandlers,
      "POST /api/auth/sign-out": () => new Response(null, { status: 204 })
    });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { route: "/orders", session: customer, withCart: true });

    await user.click(signOutButton());

    expect(await screen.findByText("home page")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(requestsTo(fetch, "POST /api/auth/sign-out")).toHaveLength(1);
  });

  it("lands on the home page even when it has to load first", async () => {
    stubApi({ ...customerHandlers, "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    const LazyHome = lazy(() => Promise.resolve({ default: () => <p>lazy home page</p> }));
    renderWithProviders(
      <>
        <Suspense>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<LazyHome />} />
              <Route path="auth/sign-in" element={<p>sign in form</p>} />
              <Route element={<RequireUser />}>
                <Route path="orders" element={<p>orders list</p>} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
        <LocationDisplay />
      </>,
      { route: "/orders", session: customer, withCart: true }
    );

    await user.click(signOutButton());

    expect(await screen.findByText("lazy home page")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("moves focus to the main content even when already on the home page", async () => {
    stubApi({ ...customerHandlers, "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderWithProviders(app, { session: customer, withCart: true });

    await user.click(signOutButton());

    await screen.findByRole("link", { name: "Sign in" });
    expect(document.activeElement).toBe(screen.getByRole("main"));
  });

  it("drops cached data from the signed-in session", async () => {
    stubApi({ ...customerHandlers, "POST /api/auth/sign-out": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { session: customer, withCart: true });
    queryClient.setQueryData(["api", "orders", "listOrders", {}], [{ id: "order-1" }]);

    expect(await screen.findByRole("link", { name: "Cart, 2 items" })).toBeTruthy();

    await user.click(signOutButton());
    await screen.findByRole("link", { name: "Sign in" });

    expect(queryClient.getQueryData(["api", "orders", "listOrders", {}])).toBeUndefined();
    expect(screen.getByRole("link", { name: "Cart, 0 items" })).toBeTruthy();
  });

  it("keeps the user signed in and says so when sign out fails", async () => {
    stubApi({ ...customerHandlers, "POST /api/auth/sign-out": () => json(500, { message: "boom" }) });
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(app, { route: "/orders", session: customer, withCart: true });

    await user.click(signOutButton());

    expect((await screen.findByRole("alert")).textContent).toBe("Couldn't sign you out. Try again.");
    expect(screen.getByText("orders list")).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toEqual(customer);
  });
});
