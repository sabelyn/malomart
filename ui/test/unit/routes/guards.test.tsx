import { screen } from "@testing-library/react";
import { Route, Routes } from "react-router";

import ErrorBoundary from "@/components/ErrorBoundary";
import { GuestOnly, RequireAdmin, RequireUser } from "@/routes/guards";
import { admin, customer, LocationDisplay, neverResolvingFetch, renderWithProviders } from "../../utils";

const routes = (
  <>
    <ErrorBoundary fallback={() => <p>boundary caught</p>}>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/auth" element={<GuestOnly />}>
          <Route path="sign-in" element={<p>sign in form</p>} />
        </Route>
        <Route element={<RequireUser />}>
          <Route path="/orders" element={<p>orders list</p>} />
        </Route>
        <Route path="/admin" element={<RequireAdmin />}>
          <Route index element={<p>back office</p>} />
        </Route>
      </Routes>
    </ErrorBoundary>
    <LocationDisplay />
  </>
);

const location = () => screen.getByTestId("location").textContent;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RequireUser", () => {
  it("renders the page for a signed-in user", () => {
    renderWithProviders(routes, { route: "/orders", session: customer });

    expect(screen.getByText("orders list")).toBeTruthy();
  });

  it("redirects a signed-out user to sign in with a return path", () => {
    renderWithProviders(routes, { route: "/orders?page=2", session: null });

    expect(location()).toBe(`/auth/sign-in?${new URLSearchParams({ returnTo: "/orders?page=2" })}`);
    expect(screen.getByText("sign in form")).toBeTruthy();
  });

  it("shows a loader while the session is loading", () => {
    neverResolvingFetch();
    renderWithProviders(routes, { route: "/orders" });

    expect(screen.getByRole("status").textContent).toContain("Loading");
    expect(screen.queryByText("orders list")).toBeNull();
  });

  it("hands session errors to the error boundary", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "boom" }), { status: 500 })));
    renderWithProviders(routes, { route: "/orders" });

    expect(await screen.findByText("boundary caught")).toBeTruthy();
  });
});

describe("RequireAdmin", () => {
  it("renders the page for an admin", () => {
    renderWithProviders(routes, { route: "/admin", session: admin });

    expect(screen.getByText("back office")).toBeTruthy();
  });

  it("shows not found to a signed-in customer", () => {
    renderWithProviders(routes, { route: "/admin", session: customer });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Nothing on this shelf");
    expect(screen.queryByText("back office")).toBeNull();
    expect(location()).toBe("/admin");
  });

  it("redirects a signed-out user to sign in", () => {
    renderWithProviders(routes, { route: "/admin", session: null });

    expect(location()).toBe(`/auth/sign-in?${new URLSearchParams({ returnTo: "/admin" })}`);
  });
});

describe("GuestOnly", () => {
  it("renders the page for a signed-out user", () => {
    renderWithProviders(routes, { route: "/auth/sign-in", session: null });

    expect(screen.getByText("sign in form")).toBeTruthy();
  });

  it("sends a signed-in user to the return path", () => {
    renderWithProviders(routes, { route: `/auth/sign-in?${new URLSearchParams({ returnTo: "/orders" })}`, session: customer });

    expect(location()).toBe("/orders");
  });

  it.each([
    ["no return path", "/auth/sign-in"],
    ["an off-site return path", `/auth/sign-in?${new URLSearchParams({ returnTo: "//evil.example" })}`],
    ["an api return path", `/auth/sign-in?${new URLSearchParams({ returnTo: "/api/auth/sign-out" })}`]
  ])("sends a signed-in user home with %s", (_, route) => {
    renderWithProviders(routes, { route, session: customer });

    expect(location()).toBe("/");
  });
});
