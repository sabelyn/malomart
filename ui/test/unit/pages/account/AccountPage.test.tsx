import type { CustomerDto } from "@mm/lib/customers";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import AccountPage from "@/pages/account/AccountPage";
import ProfileSection from "@/pages/account/ProfileSection";
import { customer, json, renderWithProviders, stubApi } from "../../../utils";

const customerData: CustomerDto = {
  id: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  defaultAddress: {
    id: "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01",
    label: "Home",
    recipient: "Link",
    street: "1 Ordon Lane",
    city: "Ordon Village",
    region: "Faron",
    postalCode: "11111",
    isDefault: true
  },
  defaultPaymentMethod: {
    id: "8f2b6d3a-1c4e-4b7f-9a2d-3e5f7a9c1b20",
    brand: "Hyrulean Express",
    lastFour: "4242",
    expirationMonth: 4,
    expirationYear: 2030,
    isDefault: true
  },
  cart: {}
};

const renderAccount = (route = "/account") =>
  renderWithProviders(
    <Routes>
      <Route path="/account" element={<AccountPage />}>
        <Route index element={<ProfileSection />} />
        <Route path="addresses" element={<h2>Addresses</h2>} />
      </Route>
    </Routes>,
    { route, session: customer }
  );

const sectionNav = () => screen.getByRole("navigation", { name: "Account sections" });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AccountPage", () => {
  it("shows the profile with the customer's defaults", async () => {
    stubApi({ "GET /api/customers": () => json(200, customerData) });
    renderAccount();

    expect(screen.getByRole("heading", { level: 1, name: "Your account" })).toBeTruthy();
    expect(within(sectionNav()).getByRole("link", { name: "Profile" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Link")).toBeTruthy();
    expect(screen.getByText("link@hyrule.com")).toBeTruthy();
    expect(await screen.findByText("Ordon Village, Faron 11111")).toBeTruthy();
    expect(screen.getByText("Hyrulean Express ending in 4242")).toBeTruthy();
    expect(screen.getByText("Expires 05/2030")).toBeTruthy();
    expect(document.title).toBe("Your account · Malo Mart");
  });

  it("says when no defaults are set", async () => {
    stubApi({
      "GET /api/customers": () => json(200, { ...customerData, defaultAddress: null, defaultPaymentMethod: null })
    });
    renderAccount();

    expect(await screen.findAllByText("None set.")).toHaveLength(2);
  });

  it("switches sections from the section nav", async () => {
    stubApi({ "GET /api/customers": () => json(200, customerData) });
    const user = userEvent.setup();
    renderAccount();

    await user.click(within(sectionNav()).getByRole("link", { name: "Addresses" }));

    expect(screen.getByRole("heading", { level: 2, name: "Addresses" })).toBeTruthy();
    expect(within(sectionNav()).getByRole("link", { name: "Addresses" }).getAttribute("aria-current")).toBe("page");
    expect(within(sectionNav()).getByRole("link", { name: "Profile" }).getAttribute("aria-current")).toBeNull();
  });
});
