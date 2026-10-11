import type { PaymentMethodDto } from "@mm/lib/customers";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import PaymentMethodsSection from "@/pages/account/PaymentMethodsSection";
import { customer, json, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const EXPRESS_ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const CASTLE_ID = "8f2b6d3a-1c4e-4b7f-9a2d-3e5f7a9c1b20";
const LIST = "GET /api/customers/payment-methods";
const TOKENIZE = "POST /api/tokenize";
const CREATE = "POST /api/customers/payment-methods";

const express: PaymentMethodDto = {
  id: EXPRESS_ID,
  brand: "Hyrulian Express",
  lastFour: "4242",
  expirationMonth: 4,
  expirationYear: 2030,
  isDefault: false
};

const castle: PaymentMethodDto = {
  id: CASTLE_ID,
  brand: "Castle One",
  lastFour: "1111",
  expirationMonth: 2,
  expirationYear: 2025,
  isDefault: true
};

const EXPRESS_NAME = "Hyrulian Express ending in 4242";
const CASTLE_NAME = "Castle One ending in 1111";

let methods: PaymentMethodDto[];

const renderSection = () => renderWithProviders(<PaymentMethodsSection />, { session: customer });

const card = (name: string) => screen.getByRole("article", { name: new RegExp(`^${name}`) });

const dialog = () => screen.getByRole("dialog");

const loaded = () => screen.findByRole("heading", { name: EXPRESS_NAME });

const fillNewCard = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByLabelText("Hyrulian Express"));
  await user.type(screen.getByLabelText(/^Card number/), "4111 1111 1111 4242");
  await user.selectOptions(screen.getByLabelText(/^Expiration month/), "05");
  await user.selectOptions(screen.getByLabelText(/^Expiration year/), "2030");
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 5, 15));
  methods = [express, castle];
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PaymentMethodsSection", () => {
  it("lists cards with the default first and flags expired ones", async () => {
    stubApi({ [LIST]: () => json(200, methods) });
    renderSection();
    await loaded();

    const headings = screen.getAllByRole("heading", { level: 3 }).map(heading => heading.textContent);

    expect(headings).toEqual([`${CASTLE_NAME}DefaultExpired`, EXPRESS_NAME]);
    expect(within(card(CASTLE_NAME)).getByText("Expired 03/2025")).toBeTruthy();
    expect(within(card(EXPRESS_NAME)).getByText("Expires 05/2030")).toBeTruthy();
    expect(document.title).toBe("Payment methods · Malo Mart");
  });

  it("shows an empty state", async () => {
    stubApi({ [LIST]: () => json(200, []) });
    renderSection();

    expect(await screen.findByText("No cards on file. I don't do IOUs.")).toBeTruthy();
  });

  it("vaults the card and then saves the token", async () => {
    const created: PaymentMethodDto = { ...express, id: "0c4d2a1b-9e8f-4a7b-8c6d-5e4f3a2b1c0d", isDefault: true };
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [TOKENIZE]: () => json(201, { token: "vault-token" }),
      [CREATE]: () => {
        methods = [created];
        return json(201, created);
      }
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    expect(within(dialog()).getByRole("heading", { name: "Add a card" })).toBeTruthy();
    await fillNewCard(user);
    await user.click(screen.getByLabelText("Make this my default payment method"));
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, TOKENIZE)).toEqual([
      { brand: "Hyrulian Express", cardNumber: "4111111111114242", expirationMonth: 4, expirationYear: 2030 }
    ]);
    expect(requestsTo(fetch, CREATE)).toEqual([{ token: "vault-token", setAsDefault: true }]);
    expect(screen.getByRole("status").textContent).toBe(`Added ${EXPRESS_NAME}.`);
  });

  it("shows validation errors without contacting the vault", async () => {
    const fetch = stubApi({ [LIST]: () => json(200, methods) });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    await user.type(screen.getByLabelText(/^Card number/), "4111");
    await user.click(screen.getByRole("button", { name: "Save card" }));

    expect(screen.getByText("Choose a card brand.")).toBeTruthy();
    expect(screen.getByText("Enter the 16-digit card number.")).toBeTruthy();
    expect(screen.getByText("Choose a month.")).toBeTruthy();
    expect(screen.getByText("Choose a year.")).toBeTruthy();
    expect(requestsTo(fetch, TOKENIZE)).toHaveLength(0);
  });

  it("rejects a card that has already expired", async () => {
    const fetch = stubApi({ [LIST]: () => json(200, methods) });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    await fillNewCard(user);
    await user.selectOptions(screen.getByLabelText(/^Expiration year/), "2026");
    await user.click(screen.getByRole("button", { name: "Save card" }));

    expect(screen.getByText("That card has expired.")).toBeTruthy();
    expect(requestsTo(fetch, TOKENIZE)).toHaveLength(0);
  });

  it("reuses the vault token when only saving it failed", async () => {
    let failCreate = true;
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [TOKENIZE]: () => json(201, { token: "vault-token" }),
      [CREATE]: () => (failCreate ? json(500, { message: "nope" }) : json(201, express))
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    await fillNewCard(user);
    await user.click(screen.getByRole("button", { name: "Save card" }));
    expect(await within(dialog()).findByText("Couldn't save that card. Try again.")).toBeTruthy();

    failCreate = false;
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, TOKENIZE)).toHaveLength(1);
    expect(requestsTo(fetch, CREATE)).toEqual([{ token: "vault-token" }, { token: "vault-token" }]);
  });

  it("vaults the card again when its details change after a failure", async () => {
    let failCreate = true;
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [TOKENIZE]: () => json(201, { token: "vault-token" }),
      [CREATE]: () => (failCreate ? json(500, { message: "nope" }) : json(201, express))
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    await fillNewCard(user);
    await user.click(screen.getByRole("button", { name: "Save card" }));
    await within(dialog()).findByText("Couldn't save that card. Try again.");

    failCreate = false;
    await user.selectOptions(screen.getByLabelText(/^Expiration year/), "2031");
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, TOKENIZE).map(body => body.expirationYear)).toEqual([2030, 2031]);
  });

  it("explains when the vault rejects the card", async () => {
    stubApi({
      [LIST]: () => json(200, methods),
      [TOKENIZE]: () => json(400, { message: "Invalid card data" })
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(screen.getByRole("button", { name: "Add a card" }));
    await fillNewCard(user);
    await user.click(screen.getByRole("button", { name: "Save card" }));

    expect(
      await within(dialog()).findByText("The vault didn't like that card. Check the details and try again.")
    ).toBeTruthy();
  });

  it("updates the expiration", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [`PUT /api/customers/payment-methods/${CASTLE_ID}`]: () =>
        json(200, { ...castle, expirationMonth: 0, expirationYear: 2031 })
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(within(card(CASTLE_NAME)).getByRole("button", { name: "Edit" }));
    expect(within(dialog()).getByRole("heading", { name: `Edit ${CASTLE_NAME}` })).toBeTruthy();
    expect(screen.queryByLabelText("Make this my default payment method")).toBeNull();
    await user.selectOptions(screen.getByLabelText(/^Expiration month/), "01");
    await user.selectOptions(screen.getByLabelText(/^Expiration year/), "2031");
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, `PUT /api/customers/payment-methods/${CASTLE_ID}`)).toEqual([
      { expiration: { expirationMonth: 0, expirationYear: 2031 } }
    ]);
    expect(screen.getByRole("status").textContent).toBe(`Saved ${CASTLE_NAME}.`);
  });

  it("only sends the default flag when the expiration is unchanged", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [`PUT /api/customers/payment-methods/${EXPRESS_ID}`]: () => json(200, { ...express, isDefault: true })
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(within(card(EXPRESS_NAME)).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByLabelText("Make this my default payment method"));
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, `PUT /api/customers/payment-methods/${EXPRESS_ID}`)).toEqual([{ setAsDefault: true }]);
  });

  it("closes without saving when nothing changed", async () => {
    const fetch = stubApi({ [LIST]: () => json(200, methods) });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(within(card(EXPRESS_NAME)).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("removes a card after confirming and focuses the section heading", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [`DELETE /api/customers/payment-methods/${EXPRESS_ID}`]: () => {
        methods = [castle];
        return new Response(null, { status: 204 });
      }
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(within(card(EXPRESS_NAME)).getByRole("button", { name: "Delete" }));
    const descriptionId = dialog().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(descriptionId)?.textContent).toBe(`${EXPRESS_NAME} will be wiped from the vault.`);
    await user.click(screen.getByRole("button", { name: "Remove card" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, `DELETE /api/customers/payment-methods/${EXPRESS_ID}`)).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: EXPRESS_NAME })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(`Removed ${EXPRESS_NAME}.`);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
  });

  it("makes a card the default and keeps focus on its card", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, methods),
      [`PUT /api/customers/payment-methods/${EXPRESS_ID}`]: () => {
        methods = [
          { ...express, isDefault: true },
          { ...castle, isDefault: false }
        ];
        return json(200, { ...express, isDefault: true });
      }
    });
    const user = userEvent.setup();
    renderSection();
    await loaded();

    await user.click(within(card(EXPRESS_NAME)).getByRole("button", { name: "Make default" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(card(EXPRESS_NAME)).getByRole("button", { name: "Edit" }))
    );
    expect(requestsTo(fetch, `PUT /api/customers/payment-methods/${EXPRESS_ID}`)).toEqual([{ setAsDefault: true }]);
    expect(screen.getByRole("status").textContent).toBe(`${EXPRESS_NAME} is now your default payment method.`);
  });
});
