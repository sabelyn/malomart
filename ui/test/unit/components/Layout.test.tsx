import { fireEvent, screen } from "@testing-library/react";
import { Link, Route, Routes } from "react-router";

import Layout from "@/components/Layout";
import { customer, renderWithProviders } from "../../utils";

const Thrower = () => {
  throw new Error("kaboom");
};

const app = (
  <Routes>
    <Route element={<Layout />}>
      <Route index element={<Link to="/other">go elsewhere</Link>} />
      <Route path="other" element={<p>other page</p>} />
      <Route path="broken" element={<Thrower />} />
    </Route>
  </Routes>
);

const main = () => screen.getByRole("main");

describe("Layout", () => {
  it("renders the page inside the main landmark with a skip link", () => {
    renderWithProviders(app, { session: null });

    expect(main().id).toBe("main");
    expect(screen.getByRole("link", { name: "Skip to content" }).getAttribute("href")).toBe("#main");
    expect(screen.getByRole("link", { name: "go elsewhere" })).toBeTruthy();
  });

  it("leaves focus alone on the first render", () => {
    renderWithProviders(app, { session: null });

    expect(document.activeElement).not.toBe(main());
  });

  it("moves focus to the main content after navigating", () => {
    renderWithProviders(app, { session: null });

    fireEvent.click(screen.getByRole("link", { name: "go elsewhere" }));

    expect(screen.getByText("other page")).toBeTruthy();
    expect(document.activeElement).toBe(main());
  });

  it("marks the current page in the main navigation", () => {
    renderWithProviders(app, { session: customer });

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Shop");
    expect(screen.getByRole("link", { name: "Orders" })).toBeTruthy();
  });

  it("offers sign in with a return path when signed out", () => {
    renderWithProviders(app, { route: "/other", session: null });

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe(
      `/auth/sign-in?${new URLSearchParams({ returnTo: "/other" })}`
    );
  });

  it("shows the error page when a page throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    renderWithProviders(app, { route: "/broken", session: null });

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Something broke.");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
