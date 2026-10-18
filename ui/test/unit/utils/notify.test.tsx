import { act } from "@testing-library/react";

import { notify } from "@/utils/notify";
import { announced, renderWithProviders, toasts } from "../../utils";

describe("notify", () => {
  it("shows a toast and announces it politely", () => {
    renderWithProviders(null);

    act(() => notify({ title: "Added", message: "Hawkeye is in your cart." }));

    expect(toasts()).toEqual(["AddedHawkeye is in your cart."]);
    expect(announced()).toBe("Added. Hawkeye is in your cart.");
    expect(announced("assertive")).toBe("");
  });

  it("announces errors assertively", () => {
    renderWithProviders(null);

    act(() => notify({ tone: "error", message: "Couldn't save your cart." }));

    expect(announced("assertive")).toBe("Couldn't save your cart.");
    expect(announced()).toBe("");
  });

  it("keeps the toast from being its own alert", () => {
    renderWithProviders(null);

    act(() => notify({ message: "Removed Hawkeye from your cart." }));

    const toast = document.querySelector(".mantine-Notification-root");
    expect(toast?.getAttribute("role")).toBe("none");
  });
});
