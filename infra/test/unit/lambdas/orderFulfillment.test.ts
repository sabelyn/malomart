import type { InvokeCommandOutput } from "@aws-sdk/client-lambda";
import { InvokeCommand } from "@aws-sdk/client-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { LocalDurableTestRunner, OperationStatus } from "@aws/durable-execution-sdk-js-testing";
import { dbClient } from "@mm/clients/db";
import { lambdaClient } from "@mm/clients/lambda";
import type { ChargeCardResult } from "@mm/lib/lambdas";
import type { Order } from "@mm/lib/orders";
import { PAYMENT_SECONDS, ShippingOptions } from "@mm/lib/orders";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/orderFulfillment";
import { awsError } from "../../helpers/lambda";

const db = mockClient(dbClient());
const lambda = mockClient(lambdaClient());

const order: Order = {
  id: crypto.randomUUID(),
  customerId: crypto.randomUUID(),
  address: { recipient: "Link", street: "1 Ordon Way", city: "Ordon", region: "Faron", postalCode: "12345" },
  paymentMethod: { brand: "Castle One", expirationMonth: 4, expirationYear: 2030, lastFour: "4242", token: "card-token" },
  orderDate: "2026-10-16T12:00:00.000Z",
  currentStatus: "Placed",
  statusUpdates: { Placed: "2026-10-16T12:00:00.000Z" },
  products: { [crypto.randomUUID()]: { amount: 2, pricePerUnit: 50 } },
  shipping: { method: "Express", cost: 40 }
};

const event = { detail: { orderId: order.id, customerId: order.customerId, previousStatus: null, status: "Placed" } };

const chargeResponds = (result: ChargeCardResult | { errorName: string }) =>
  lambda
    .on(InvokeCommand)
    .resolves({ Payload: Buffer.from(JSON.stringify(result)) as unknown as InvokeCommandOutput["Payload"] });

const transitionsTo = (status: string) => ({ ExpressionAttributeValues: { ":to": status } });

const transitionedTo = () =>
  db
    .commandCalls(UpdateCommand)
    .map(call => call.args[0].input.ExpressionAttributeValues?.[":to"])
    .filter(Boolean);

const run = () => {
  const runner = new LocalDurableTestRunner({ handlerFunction: handler });
  return { runner, execution: runner.run({ payload: event }) };
};

beforeAll(() => LocalDurableTestRunner.setupTestEnvironment({ skipTime: true }));
afterAll(() => LocalDurableTestRunner.teardownTestEnvironment());

beforeEach(() => {
  db.reset();
  lambda.reset();
  db.on(UpdateCommand).resolves({});
  db.on(UpdateCommand, { UpdateExpression: "SET fulfillmentToken = :token" }).resolves({ Attributes: order });
  chargeResponds({ approved: true, chargeId: crypto.randomUUID() });
});

it("takes an approved order through to delivery", async () => {
  const { runner, execution } = run();
  const result = await execution;

  expect(result.getStatus()).toBe("SUCCEEDED");
  expect(result.getResult()).toEqual({ orderId: order.id, status: "Delivered" });
  expect(transitionedTo()).toEqual(["Confirmed", "Shipped", "Delivered"]);
  expect(runner.getOperation("deliver").getStatus()).toBe(OperationStatus.SUCCEEDED);
});

it("claims the order only while it is placed and unclaimed", async () => {
  await run().execution;

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    TableName: "orders",
    Key: { id: order.id },
    ConditionExpression: "currentStatus = :placed AND attribute_not_exists(fulfillmentToken)",
    ExpressionAttributeValues: { ":placed": "Placed", ":token": expect.any(String) }
  });
});

it("charges the order total to the order's card", async () => {
  await run().execution;

  const payload = JSON.parse(lambda.commandCalls(InvokeCommand)[0].args[0].input.Payload as string);
  expect(lambda).toHaveReceivedCommandWith(InvokeCommand, { FunctionName: "charge-card" });
  expect(payload).toEqual({ orderId: order.id, customerId: order.customerId, token: "card-token", amount: 140 });
});

it("waits within the shipping method's ranges", async () => {
  const { runner, execution } = run();
  await execution;

  const seconds = (name: string) => runner.getOperation(name).getWaitDetails()!.waitSeconds!;
  const { shipSeconds, deliverSeconds } = ShippingOptions.Express.fulfillment;
  const [paymentMin, paymentMax] = PAYMENT_SECONDS;
  expect(seconds("payment-processing")).toBeGreaterThanOrEqual(paymentMin);
  expect(seconds("payment-processing")).toBeLessThanOrEqual(paymentMax);
  expect(seconds("awaiting-shipment")).toBeGreaterThanOrEqual(shipSeconds[0]);
  expect(seconds("awaiting-shipment")).toBeLessThanOrEqual(shipSeconds[1]);
  const delivery = seconds("awaiting-shipment") + seconds("in-transit");
  expect(delivery).toBeGreaterThanOrEqual(deliverSeconds[0]);
  expect(delivery).toBeLessThanOrEqual(deliverSeconds[1]);
});

it("records each status change with its time", async () => {
  await run().execution;

  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    Key: { id: order.id },
    ConditionExpression: "currentStatus = :from",
    UpdateExpression: "SET currentStatus = :to, statusUpdates.#to = :now",
    ExpressionAttributeNames: { "#to": "Shipped" },
    ExpressionAttributeValues: { ":from": "Confirmed", ":to": "Shipped", ":now": expect.any(String) }
  });
});

it("cancels a declined order with the decline as the reason", async () => {
  chargeResponds({ approved: false, reason: "Declined" });

  const result = await run().execution;

  expect(result.getResult()).toEqual({ orderId: order.id, status: "Cancelled" });
  expect(transitionedTo()).toEqual(["Cancelled"]);
  expect(db).toHaveReceivedCommandWith(UpdateCommand, {
    ConditionExpression: "currentStatus = :from",
    UpdateExpression: "SET currentStatus = :to, statusUpdates.#to = :now, cancellationReason = :reason",
    ExpressionAttributeValues: expect.objectContaining({ ":from": "Placed", ":reason": "PaymentDeclined" })
  });
});

it("stops without charging when the order was already claimed or cancelled", async () => {
  db.on(UpdateCommand, { UpdateExpression: "SET fulfillmentToken = :token" }).rejects(
    awsError("ConditionalCheckFailedException")
  );

  const result = await run().execution;

  expect(result.getResult()).toEqual({ orderId: order.id, status: null });
  expect(lambda).not.toHaveReceivedAnyCommand();
  expect(transitionedTo()).toEqual([]);
});

it("stops after payment when the customer cancelled while it processed", async () => {
  db.on(UpdateCommand, transitionsTo("Confirmed")).rejects(awsError("ConditionalCheckFailedException"));

  const result = await run().execution;

  expect(result.getResult()).toEqual({ orderId: order.id, status: null });
  expect(transitionedTo()).toEqual(["Confirmed"]);
});

it("stops before shipping when the customer cancelled a confirmed order", async () => {
  db.on(UpdateCommand, transitionsTo("Shipped")).rejects(awsError("ConditionalCheckFailedException"));

  const result = await run().execution;

  expect(result.getResult()).toEqual({ orderId: order.id, status: "Confirmed" });
  expect(transitionedTo()).toEqual(["Confirmed", "Shipped"]);
});

it("fails the execution and leaves the order placed when charging keeps erroring", async () => {
  chargeResponds({ errorName: "InvalidCiphertextException" });

  const result = await run().execution;

  expect(result.getStatus()).toBe("FAILED");
  expect(lambda.commandCalls(InvokeCommand).length).toBeGreaterThan(1);
  expect(transitionedTo()).toEqual([]);
});
