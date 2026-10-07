import { ErrorCode } from "@mm/lib/api";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";

import { sessionKey } from "@/api";
import SignInPage from "@/pages/auth/SignInPage";
import { GuestOnly } from "@/routes/guards";
import { customer, json, LocationDisplay, renderWithProviders, requestsTo, stubApi } from "../../utils";

const EMAIL = customer.email;

const app = (
  <>
    <Routes>
      <Route path="/" element={<p>home</p>} />
      <Route path="/orders" element={<p>orders list</p>} />
      <Route path="/auth" element={<GuestOnly />}>
        <Route path="sign-in" element={<SignInPage />} />
        <Route path="sign-up" element={<p>sign up form</p>} />
      </Route>
    </Routes>
    <LocationDisplay />
  </>
);

const renderSignIn = (route = "/auth/sign-in") => renderWithProviders(app, { route, session: null });

const requestCode = async (user: ReturnType<typeof userEvent.setup>, email = EMAIL) => {
  await user.type(screen.getByRole("textbox", { name: /email/i }), email);
  await user.click(screen.getByRole("button", { name: "Email me a code" }));
};

const enterCode = async (user: ReturnType<typeof userEvent.setup>, code = "12345678") => {
  await user.type(await screen.findByRole("textbox", { name: /code/i }), code);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SignInPage", () => {
  it("validates the email before calling the API", async () => {
    const fetch = stubApi({});
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user, "not-an-email");

    expect(await screen.findByText("Enter a valid email address.")).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("signs in with an emailed code and returns to the requested page", async () => {
    const fetch = stubApi({
      "POST /api/auth/sign-in": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-in/verify": () => json(200, customer)
    });
    const user = userEvent.setup();
    const { queryClient } = renderSignIn(`/auth/sign-in?${new URLSearchParams({ returnTo: "/orders" })}`);

    await requestCode(user);
    const codeInput = await screen.findByRole("textbox", { name: /code/i });
    expect(document.activeElement).toBe(codeInput);
    expect(screen.getByText(`We emailed a code to ${EMAIL}.`)).toBeTruthy();
    await enterCode(user);

    expect(await screen.findByText("orders list")).toBeTruthy();
    expect(queryClient.getQueryData(sessionKey)).toEqual(customer);
    expect(requestsTo(fetch, "POST /api/auth/sign-in")).toEqual([{ email: EMAIL }]);
    expect(requestsTo(fetch, "POST /api/auth/sign-in/verify")).toEqual([{ code: "12345678" }]);
  });

  it("keeps the code step open after a wrong code", async () => {
    stubApi({
      "POST /api/auth/sign-in": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-in/verify": () =>
        json(400, { message: "The code is incorrect.", code: ErrorCode.InvalidCode })
    });
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user);
    await enterCode(user);

    expect((await screen.findByRole("alert")).textContent).toBe("Wrong code. Check your email and try again.");
    expect(screen.getByRole("textbox", { name: /code/i })).toBeTruthy();
  });

  it("goes back to the email step when the sign-in session has expired", async () => {
    stubApi({
      "POST /api/auth/sign-in": () => new Response(null, { status: 202 }),
      "POST /api/auth/sign-in/verify": () => json(401, { message: "Unauthorized", code: ErrorCode.NoPendingSignIn })
    });
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user);
    await enterCode(user);

    expect((await screen.findByRole("status")).textContent).toBe("That took too long. Start over.");
    expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
  });

  it("sends a new code on request", async () => {
    const fetch = stubApi({ "POST /api/auth/sign-in": () => new Response(null, { status: 202 }) });
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user);
    await user.click(await screen.findByRole("button", { name: "Send a new code" }));

    expect((await screen.findByRole("status")).textContent).toBe("New code sent.");
    expect(requestsTo(fetch, "POST /api/auth/sign-in")).toHaveLength(2);
  });

  it("lets the user switch to a different email", async () => {
    stubApi({ "POST /api/auth/sign-in": () => new Response(null, { status: 202 }) });
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user);
    await user.click(await screen.findByRole("button", { name: "Use a different email" }));

    expect(screen.getByRole("button", { name: "Email me a code" })).toBeTruthy();
  });

  it("explains rate limiting", async () => {
    stubApi({
      "POST /api/auth/sign-in": () => json(429, { message: "Too many requests.", code: ErrorCode.RateLimited })
    });
    const user = userEvent.setup();
    renderSignIn();

    await requestCode(user);

    expect((await screen.findByRole("alert")).textContent).toBe("Too many tries. Wait a few minutes.");
  });

  it("carries the return path over to sign up", () => {
    stubApi({});
    renderSignIn(`/auth/sign-in?${new URLSearchParams({ returnTo: "/orders" })}`);

    expect(screen.getByRole("link", { name: "Make an account" }).getAttribute("href")).toBe(
      `/auth/sign-up?${new URLSearchParams({ returnTo: "/orders" })}`
    );
  });
});
