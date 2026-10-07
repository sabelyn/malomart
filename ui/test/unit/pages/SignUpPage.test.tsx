import { ErrorCode } from "@mm/lib/api";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import { sessionKey } from "@/api";
import SignInPage from "@/pages/auth/SignInPage";
import SignUpPage from "@/pages/auth/SignUpPage";
import { GuestOnly } from "@/routes/guards";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../utils";

const EMAIL = customer.email;

const app = (
  <>
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/auth" element={<GuestOnly />}>
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="sign-up" element={<SignUpPage />} />
      </Route>
    </Routes>
    <LocationDisplay />
  </>
);

const renderSignUp = () => renderWithProviders(app, { route: "/auth/sign-up", session: null });

const register = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByRole("textbox", { name: /name/i }), "Link");
  await user.type(screen.getByRole("textbox", { name: /email/i }), EMAIL);
  await user.click(screen.getByRole("button", { name: "Email me a code" }));
};

const confirmCode = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(await screen.findByRole("textbox", { name: /code/i }), "123456");
  await user.click(screen.getByRole("button", { name: "Confirm account" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignUpPage", () => {
  it("requires a name and a valid email", async () => {
    const fetch = stubApi({});
    const user = userEvent.setup();
    renderSignUp();

    await user.click(screen.getByRole("button", { name: "Email me a code" }));

    expect(await screen.findByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs the user in right after confirming the account", async () => {
    const fetch = stubApi({
      "POST /api/auth/sign-up": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-up/confirm": () => json(200, { user: customer })
    });
    const user = userEvent.setup();
    const { queryClient } = renderSignUp();

    await register(user);
    await confirmCode(user);

    expect(await screen.findByText("home")).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toEqual(customer);
    expect(requestsTo(fetch, "POST /api/auth/sign-up")).toEqual([{ name: "Link", email: EMAIL }]);
    expect(requestsTo(fetch, "POST /api/auth/sign-up/confirm")).toEqual([{ email: EMAIL, code: "123456" }]);
  });

  it("sends the user to sign in when the account is confirmed without a session", async () => {
    stubApi({
      "POST /api/auth/sign-up": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-up/confirm": () => json(200, { user: null })
    });
    const user = userEvent.setup();
    renderSignUp();

    await register(user);
    await confirmCode(user);

    expect((await screen.findByRole("status")).textContent).toBe("Account confirmed. Sign in to finish.");
    expect(screen.getByTestId("location").textContent).toBe("/auth/sign-in");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /email/i }).value).toBe(EMAIL);
  });

  it("points existing members to sign in with their email filled in", async () => {
    stubApi({
      "POST /api/auth/sign-up": () =>
        json(409, { message: "An account already exists for this email.", code: ErrorCode.AccountExists })
    });
    const user = userEvent.setup();
    renderSignUp();

    await register(user);
    expect((await screen.findByRole("alert")).textContent).toContain("There's already an account for that email.");
    await user.click(screen.getByRole("link", { name: "Sign in instead" }));

    expect(screen.getByTestId("location").textContent).toBe("/auth/sign-in");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: /email/i }).value).toBe(EMAIL);
  });

  it("shows a wrong code without leaving the code step", async () => {
    stubApi({
      "POST /api/auth/sign-up": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-up/confirm": () =>
        json(400, { message: "The code has expired.", code: ErrorCode.ExpiredCode })
    });
    const user = userEvent.setup();
    renderSignUp();

    await register(user);
    await confirmCode(user);

    expect((await screen.findByRole("alert")).textContent).toBe("That code expired. Get a new one.");
    expect(screen.getByRole("textbox", { name: /code/i })).toBeTruthy();
  });
});
