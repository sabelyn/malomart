import type { AddressDto } from "@mm/lib/customers";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AddressesSection from "@/pages/account/AddressesSection";
import { customer, json, renderWithProviders, requestsTo, stubApi } from "../../../utils";

const HOME_ID = "5d0a4c1e-3b1f-4c55-9a51-7f3c2e1b8a01";
const RANCH_ID = "8f2b6d3a-1c4e-4b7f-9a2d-3e5f7a9c1b20";
const LIST = "GET /api/customers/addresses";

const home: AddressDto = {
  id: HOME_ID,
  label: "Home",
  recipient: "Link",
  street: "1 Ordon Lane",
  city: "Ordon Village",
  region: "Faron",
  postalCode: "11111",
  isDefault: false
};

const ranch: AddressDto = {
  id: RANCH_ID,
  recipient: "Malon",
  street: "2 Lon Lon Road",
  city: "Lon Lon Ranch",
  region: "Central Hyrule",
  postalCode: "22222",
  isDefault: true
};

let addresses: AddressDto[];

const renderSection = () => renderWithProviders(<AddressesSection />, { session: customer });

const card = (name: string) => screen.getByRole("article", { name: new RegExp(`^${name}`) });

const dialog = () => screen.getByRole("dialog");

beforeEach(() => {
  addresses = [home, ranch];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AddressesSection", () => {
  it("lists addresses with the default first", async () => {
    stubApi({ [LIST]: () => json(200, addresses) });
    renderSection();

    const headings = await screen.findAllByRole("heading", { level: 3 });

    expect(headings.map(heading => heading.textContent)).toEqual(["2 Lon Lon RoadDefault", "Home"]);
    expect(within(card("Home")).getByText("Ordon Village, Faron 11111")).toBeTruthy();
    expect(within(card("2 Lon Lon Road")).queryByRole("button", { name: "Make default" })).toBeNull();
    expect(document.title).toBe("Addresses · Malo Mart");
  });

  it("shows an empty state", async () => {
    stubApi({ [LIST]: () => json(200, []) });
    renderSection();

    expect(await screen.findByText("No addresses yet. Can't deliver to nowhere.")).toBeTruthy();
  });

  it("offers a retry when loading fails", async () => {
    let fail = true;
    stubApi({ [LIST]: () => (fail ? json(500, { message: "nope" }) : json(200, addresses)) });
    const user = userEvent.setup();
    renderSection();

    const alert = await screen.findByRole("alert");
    fail = false;
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Home" })).toBeTruthy();
  });

  it("adds an address", async () => {
    const created: AddressDto = { ...home, id: "0c4d2a1b-9e8f-4a7b-8c6d-5e4f3a2b1c0d", label: "Hideout" };
    const fetch = stubApi({
      [LIST]: () => json(200, addresses),
      "POST /api/customers/addresses": () => {
        addresses = [...addresses, created];
        return json(201, created);
      }
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    expect(within(dialog()).getByRole("heading", { name: "Add an address" })).toBeTruthy();
    expect(dialog().hasAttribute("aria-describedby")).toBe(false);
    await user.type(screen.getByLabelText("Label"), " Hideout ");
    await user.type(screen.getByLabelText(/^Recipient/), "Link");
    await user.type(screen.getByLabelText(/^Street/), "1 Ordon Lane");
    await user.type(screen.getByLabelText(/^City/), "Ordon Village");
    await user.selectOptions(screen.getByLabelText(/^Region/), "Faron");
    await user.type(screen.getByLabelText(/^Postal code/), "11111");
    await user.click(screen.getByLabelText("Make this my default address"));
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, "POST /api/customers/addresses")).toEqual([
      {
        label: "Hideout",
        recipient: "Link",
        street: "1 Ordon Lane",
        city: "Ordon Village",
        region: "Faron",
        postalCode: "11111",
        setAsDefault: true
      }
    ]);
    expect(screen.getByRole("status").textContent).toBe("Saved Hideout.");
    expect(await screen.findByRole("heading", { name: "Hideout" })).toBeTruthy();
  });

  it("leaves the label out when it is blank", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, addresses),
      "POST /api/customers/addresses": () => json(201, ranch)
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await user.type(screen.getByLabelText("Label"), "   ");
    await user.type(screen.getByLabelText(/^Recipient/), "Malon");
    await user.type(screen.getByLabelText(/^Street/), "2 Lon Lon Road");
    await user.type(screen.getByLabelText(/^City/), "Lon Lon Ranch");
    await user.selectOptions(screen.getByLabelText(/^Region/), "Central Hyrule");
    await user.type(screen.getByLabelText(/^Postal code/), "22222");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(requestsTo(fetch, "POST /api/customers/addresses")).toHaveLength(1));
    expect(requestsTo(fetch, "POST /api/customers/addresses")[0]).toEqual({
      recipient: "Malon",
      street: "2 Lon Lon Road",
      city: "Lon Lon Ranch",
      region: "Central Hyrule",
      postalCode: "22222"
    });
  });

  it("shows validation errors without saving", async () => {
    const fetch = stubApi({ [LIST]: () => json(200, addresses) });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(screen.getByRole("button", { name: "Add an address" }));
    await user.type(screen.getByLabelText(/^Postal code/), "123");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(screen.getByText("Enter who receives deliveries here.")).toBeTruthy();
    expect(screen.getByText("Enter a street address.")).toBeTruthy();
    expect(screen.getByText("Enter a city.")).toBeTruthy();
    expect(screen.getByText("Choose a region.")).toBeTruthy();
    expect(screen.getByText("Enter a 5-digit postal code.")).toBeTruthy();
    expect(requestsTo(fetch, "POST /api/customers/addresses")).toHaveLength(0);
  });

  it("edits an address and clears its label", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, addresses),
      [`PUT /api/customers/addresses/${HOME_ID}`]: () => json(200, { ...home, label: undefined, city: "Hateno" })
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("Home")).getByRole("button", { name: "Edit" }));
    expect(within(dialog()).getByRole("heading", { name: "Edit Home" })).toBeTruthy();
    expect(screen.getByLabelText(/^Region/).value).toBe("Faron");
    await user.clear(screen.getByLabelText("Label"));
    await user.clear(screen.getByLabelText(/^City/));
    await user.type(screen.getByLabelText(/^City/), "Hateno");
    await user.click(screen.getByRole("button", { name: "Save address" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, `PUT /api/customers/addresses/${HOME_ID}`)).toEqual([
      {
        label: null,
        recipient: "Link",
        street: "1 Ordon Lane",
        city: "Hateno",
        region: "Faron",
        postalCode: "11111"
      }
    ]);
    expect(screen.getByRole("status").textContent).toBe("Saved 1 Ordon Lane.");
  });

  it("hides the default checkbox when editing the default address", async () => {
    stubApi({ [LIST]: () => json(200, addresses) });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("2 Lon Lon Road")).getByRole("button", { name: "Edit" }));

    expect(screen.queryByLabelText("Make this my default address")).toBeNull();
  });

  it("keeps the dialog open and shows an error when saving fails", async () => {
    stubApi({
      [LIST]: () => json(200, addresses),
      [`PUT /api/customers/addresses/${HOME_ID}`]: () => json(500, { message: "nope" })
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("Home")).getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save address" }));

    expect(await within(dialog()).findByText("Couldn't save that address. Try again.")).toBeTruthy();
  });

  it("deletes an address after confirming and focuses the section heading", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, addresses),
      [`DELETE /api/customers/addresses/${HOME_ID}`]: () => {
        addresses = [ranch];
        return new Response(null, { status: 204 });
      }
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("Home")).getByRole("button", { name: "Delete" }));
    const descriptionId = dialog().getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(descriptionId)?.textContent).toBe("Home will be gone for good.");
    await user.click(screen.getByRole("button", { name: "Delete address" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(requestsTo(fetch, `DELETE /api/customers/addresses/${HOME_ID}`)).toHaveLength(1);
    expect(screen.queryByRole("heading", { name: "Home" })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe("Deleted Home.");
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })));
  });

  it("does not delete when cancelled", async () => {
    const fetch = stubApi({ [LIST]: () => json(200, addresses) });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("Home")).getByRole("button", { name: "Delete" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("makes an address the default and keeps focus on its card", async () => {
    const fetch = stubApi({
      [LIST]: () => json(200, addresses),
      [`PUT /api/customers/addresses/${HOME_ID}`]: () => {
        addresses = [
          { ...home, isDefault: true },
          { ...ranch, isDefault: false }
        ];
        return json(200, { ...home, isDefault: true });
      }
    });
    const user = userEvent.setup();
    renderSection();
    await screen.findByRole("heading", { name: "Home" });

    await user.click(within(card("Home")).getByRole("button", { name: "Make default" }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(card("Home")).getByRole("button", { name: "Edit" }))
    );
    expect(requestsTo(fetch, `PUT /api/customers/addresses/${HOME_ID}`)).toEqual([{ setAsDefault: true }]);
    expect(screen.getByRole("status").textContent).toBe("Home is now your default address.");
    expect(screen.getAllByRole("heading", { level: 3 })[0].textContent).toBe("HomeDefault");
  });
});
