import { ErrorCode } from "@mm/lib/api";
import type { CurrentUser } from "@mm/lib/auth";
import type { CustomerDto } from "@mm/lib/customers";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router";

import { sessionKey } from "@/api";
import ProfileSection from "@/pages/account/ProfileSection";
import { GuestOnly, RequireUser } from "@/routes/guards";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const customerData: CustomerDto = {
  id: "9b1e4c2a-5d3f-4a6b-8c7d-1e2f3a4b5c6d",
  defaultAddress: null,
  defaultPaymentMethod: null
};

const GET_CUSTOMER = { "GET /api/customers": () => json(200, customerData) };
const accepted = () => new Response(null, { status: 202 });

const renderProfile = (session: CurrentUser = customer) =>
  renderWithProviders(
    <>
      <Routes>
        <Route path="/" element={<p>home</p>} />
        <Route path="/account" element={<ProfileSection />} />
      </Routes>
      <LocationDisplay />
    </>,
    { route: "/account", session }
  );

const dialog = () => screen.getByRole("dialog");

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ProfileSection", () => {
  it("changes the name", async () => {
    const fetch = stubApi({
      ...GET_CUSTOMER,
      "PUT /api/auth/me": () => json(200, { ...customer, name: "Hero of Twilight" })
    });
    const user = userEvent.setup();
    const { queryClient } = renderProfile();

    await user.click(screen.getByRole("button", { name: "Change name" }));
    const name = within(dialog()).getByRole("textbox", { name: /name/i });
    await user.clear(name);
    await user.type(name, "  Hero of Twilight ");
    await user.click(within(dialog()).getByRole("button", { name: "Save name" }));

    expect(await screen.findByText("Name updated.")).toBeTruthy();
    expect(screen.getByText("Hero of Twilight")).toBeTruthy();
    expect(requestsTo(fetch, "PUT /api/auth/me")).toEqual([{ name: "Hero of Twilight" }]);
    expect(queryClient.getQueryData<CurrentUser>(sessionKey)?.name).toBe("Hero of Twilight");
  });

  it("changes the email with an emailed code", async () => {
    const fetch = stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/email": accepted,
      "POST /api/auth/me/email/confirm": () => json(200, { ...customer, email: "hero@twilight.com" })
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Change email" }));
    await user.type(within(dialog()).getByRole("textbox", { name: /new email/i }), "hero@twilight.com");
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));
    await user.type(await within(dialog()).findByRole("textbox", { name: /code/i }), "12345678");
    await user.click(within(dialog()).getByRole("button", { name: "Confirm new email" }));

    expect(await screen.findByText("Email updated.")).toBeTruthy();
    expect(screen.getByText("hero@twilight.com")).toBeTruthy();
    expect(requestsTo(fetch, "POST /api/auth/me/email")).toEqual([{ email: "hero@twilight.com" }]);
    expect(requestsTo(fetch, "POST /api/auth/me/email/confirm")).toEqual([{ code: "12345678" }]);
  });

  it("rejects the current email before calling the API", async () => {
    const fetch = stubApi(GET_CUSTOMER);
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Change email" }));
    await user.type(within(dialog()).getByRole("textbox", { name: /new email/i }), "LINK@hyrule.com");
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));

    expect(await within(dialog()).findByText("That's already your email.")).toBeTruthy();
    expect(requestsTo(fetch, "POST /api/auth/me/email")).toHaveLength(0);
  });

  it("says when another account has the new email", async () => {
    stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/email": () => json(409, { message: "Taken.", code: ErrorCode.AccountExists })
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Change email" }));
    await user.type(within(dialog()).getByRole("textbox", { name: /new email/i }), "zelda@hyrule.com");
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));

    expect(await within(dialog()).findByText("There's already an account for that email.")).toBeTruthy();
  });

  it("doesn't offer an email change to Google users", () => {
    stubApi(GET_CUSTOMER);
    renderProfile({ ...customer, signInMethod: "google" });

    expect(screen.queryByRole("button", { name: "Change email" })).toBeNull();
    expect(screen.getByText(/Google manages this one/)).toBeTruthy();
  });

  it("signs out everywhere and lands on sign-in", async () => {
    const fetch = stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/sign-out": () => new Response(null, { status: 204 })
    });
    const user = userEvent.setup();
    const SignInPage = lazy(() => import("@/pages/auth/SignInPage"));
    const { queryClient } = renderWithProviders(
      <>
        <Suspense>
          <Routes>
            <Route element={<RequireUser />}>
              <Route path="/account" element={<ProfileSection />} />
            </Route>
            <Route element={<GuestOnly />}>
              <Route path="/auth/sign-in" element={<SignInPage />} />
            </Route>
          </Routes>
        </Suspense>
        <LocationDisplay />
      </>,
      { route: "/account", session: customer }
    );

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    expect(await screen.findByText("Signed out on every device.")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/auth/sign-in");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /email/i }).value).toBe(customer.email);
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(requestsTo(fetch, "POST /api/auth/me/sign-out")).toHaveLength(1);
  });

  it("says when signing out everywhere fails", async () => {
    stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/sign-out": () => json(500, { message: "nope" })
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Sign out everywhere" }));

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByText("Couldn't sign you out everywhere. Try again.")).toBeTruthy();
    expect(screen.getByTestId("location").textContent).toBe("/account");
  });

  it("deletes the account and signs out", async () => {
    const fetch = stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/deletion": accepted,
      "POST /api/auth/me/deletion/confirm": () => new Response(null, { status: 204 })
    });
    const user = userEvent.setup();
    const { queryClient } = renderProfile();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));
    await user.type(await within(dialog()).findByRole("textbox", { name: /code/i }), "12345678");
    await user.click(within(dialog()).getByRole("button", { name: "Delete my account" }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/"));
    expect(queryClient.getQueryData(sessionKey)).toBeNull();
    expect(requestsTo(fetch, "POST /api/auth/me/deletion/confirm")).toEqual([{ code: "12345678" }]);
  });

  it("shows a wrong code without leaving the code step", async () => {
    stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/deletion": accepted,
      "POST /api/auth/me/deletion/confirm": () => json(400, { message: "Bad code.", code: ErrorCode.InvalidCode })
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));
    await user.type(await within(dialog()).findByRole("textbox", { name: /code/i }), "12345678");
    await user.click(within(dialog()).getByRole("button", { name: "Delete my account" }));

    expect(await within(dialog()).findByText("Wrong code. Check your email and try again.")).toBeTruthy();
    expect(within(dialog()).getByRole("textbox", { name: /code/i })).toBeTruthy();
  });

  it("starts the deletion over when it times out", async () => {
    stubApi({
      ...GET_CUSTOMER,
      "POST /api/auth/me/deletion": accepted,
      "POST /api/auth/me/deletion/confirm": () =>
        json(401, { message: "Expired.", code: ErrorCode.NoPendingSignIn }),
      "POST /api/auth/refresh": () => new Response(null, { status: 204 })
    });
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole("button", { name: "Delete account" }));
    await user.click(within(dialog()).getByRole("button", { name: "Email me a code" }));
    await user.type(await within(dialog()).findByRole("textbox", { name: /code/i }), "12345678");
    await user.click(within(dialog()).getByRole("button", { name: "Delete my account" }));

    expect(await within(dialog()).findByText("That took too long. Start over.")).toBeTruthy();
    expect(within(dialog()).getByRole("button", { name: "Email me a code" })).toBeTruthy();
  });
});
