import type { OrderDto } from "@mm/lib/orders";
import { screen, within } from "@testing-library/react";

import OrderUpdates from "@/components/orders/OrderUpdates";
import { renderWithProviders } from "../../../utils";

const cancelled = (cancellationReason?: OrderDto["cancellationReason"]) => ({
  currentStatus: "Cancelled" as const,
  statusUpdates: { Placed: "2026-10-16T12:00:00.000Z", Cancelled: "2026-10-16T12:00:10.000Z" },
  cancellationReason
});

const cancelledStep = () => within(screen.getByRole("listitem", { current: "step" }));

it("says the payment was declined when that's why the order was cancelled", () => {
  renderWithProviders(<OrderUpdates order={cancelled("PaymentDeclined")} />);

  expect(cancelledStep().getByText("Cancelled")).toBeTruthy();
  expect(cancelledStep().getByText("Payment declined. Nothing ships.")).toBeTruthy();
});

it.each(["Requested", undefined] as const)("uses the usual cancelled note for reason %s", reason => {
  renderWithProviders(<OrderUpdates order={cancelled(reason)} />);

  expect(cancelledStep().getByText("Cancelled. Nothing ships.")).toBeTruthy();
  expect(screen.queryByText(/Payment declined/)).toBeNull();
});
