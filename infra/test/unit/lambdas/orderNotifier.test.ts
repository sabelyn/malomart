import { AdminGetUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { BatchGetCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { Order } from "@mm/lib/orders";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/orderNotifier";
import { awsError } from "../../helpers/lambda";

const db = mockClient(dbClient());
const cognito = mockClient(CognitoIdentityProviderClient);
const ses = mockClient(SESv2Client);

const mask = crypto.randomUUID();

const order: Order = {
  id: "8a2be9e3-ee3a-4357-9a7a-de01c096f5c7",
  customerId: crypto.randomUUID(),
  address: { recipient: "Link", street: "1 Ordon Way", city: "Ordon", region: "Faron", postalCode: "12345" },
  paymentMethod: { brand: "Castle One", expirationMonth: 4, expirationYear: 2030, lastFour: "4242", token: "card-token" },
  orderDate: "2026-10-16T12:00:00.000Z",
  currentStatus: "Confirmed",
  statusUpdates: { Placed: "2026-10-16T12:00:00.000Z", Confirmed: "2026-10-16T12:00:10.000Z" },
  products: { [mask]: { amount: 2, pricePerUnit: 50 } },
  shipping: { method: "Express", cost: 40 }
};

const eventFor = (status: string) =>
  ({
    detail: { orderId: order.id, customerId: order.customerId, previousStatus: "Placed", status, at: order.orderDate }
  }) as Parameters<typeof handler>[0];

const storedOrder = (item: Partial<Order> = {}) => db.on(GetCommand).resolves({ Item: { ...order, ...item } });

const sentEmail = () => ses.commandCalls(SendEmailCommand)[0].args[0].input;

beforeEach(() => {
  db.reset();
  cognito.reset();
  ses.reset();
  storedOrder();
  db.on(BatchGetCommand).resolves({ Responses: { products: [{ id: mask, title: "Mask of Truth" }] } });
  cognito.on(AdminGetUserCommand).resolves({
    Username: order.customerId,
    UserAttributes: [
      { Name: "email", Value: "link@inbox.malomart.link" },
      { Name: "name", Value: "Link" }
    ]
  });
  ses.on(SendEmailCommand).resolves({ MessageId: "message-id" });
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

it("emails the customer about their order's new status", async () => {
  await handler(eventFor("Confirmed"));

  expect(cognito).toHaveReceivedCommandWith(AdminGetUserCommand, {
    UserPoolId: "us-east-1_TestPool",
    Username: order.customerId
  });
  expect(sentEmail()).toEqual(
    expect.objectContaining({
      FromEmailAddress: "\"Malo Mart\" <noreply@malomart.test>",
      Destination: { ToAddresses: ["link@inbox.malomart.link"] }
    })
  );
  const { Subject, Body } = sentEmail().Content!.Simple!;
  expect(Subject!.Data).toBe("Order 8A2BE9E3 confirmed");
  for (const body of [Body!.Text!.Data, Body!.Html!.Data]) {
    expect(body).toContain("Mask of Truth x2: 100 rupees");
    expect(body).toContain("Total: 140 rupees");
    expect(body).toContain(`https://malomart.test/orders/${order.id}`);
  }
});

it.each([
  ["Shipped", {}, "Order 8A2BE9E3 shipped", "Epona Express"],
  ["Delivered", {}, "Order 8A2BE9E3 delivered", "It's yours now."],
  ["Cancelled", { cancellationReason: "Requested" }, "Order 8A2BE9E3 cancelled", "back on the shelf"],
  ["Cancelled", {}, "Order 8A2BE9E3 cancelled", "back on the shelf"],
  [
    "Cancelled",
    { cancellationReason: "PaymentDeclined" },
    "Order 8A2BE9E3 cancelled: payment declined",
    "Payment declined. Nothing ships."
  ]
] as const)("sends %s copy for %o", async (status, stored, subject, phrase) => {
  storedOrder({ currentStatus: status, ...stored });

  await handler(eventFor(status));

  const { Subject, Body } = sentEmail().Content!.Simple!;
  expect(Subject!.Data).toBe(subject);
  expect(Body!.Text!.Data).toContain(phrase);
});

it("doesn't email about newly placed orders", async () => {
  await handler(eventFor("Placed"));

  expect(ses).not.toHaveReceivedAnyCommand();
});

it("skips customers who no longer exist", async () => {
  cognito.on(AdminGetUserCommand).rejects(awsError("UserNotFoundException"));

  await handler(eventFor("Confirmed"));

  expect(ses).not.toHaveReceivedAnyCommand();
});

it("skips orders that no longer exist", async () => {
  db.on(GetCommand).resolves({});

  await handler(eventFor("Confirmed"));

  expect(ses).not.toHaveReceivedAnyCommand();
});

it("doesn't retry emails SES rejects", async () => {
  ses.on(SendEmailCommand).rejects(awsError("MessageRejected"));

  await expect(handler(eventFor("Confirmed"))).resolves.toBeUndefined();
});

it("fails so it is retried when sending errors otherwise", async () => {
  ses.on(SendEmailCommand).rejects(awsError("TooManyRequestsException"));

  await expect(handler(eventFor("Confirmed"))).rejects.toThrow("TooManyRequestsException");
});
