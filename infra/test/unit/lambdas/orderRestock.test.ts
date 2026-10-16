import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { BatchGetCommand, GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import type { Order } from "@mm/lib/orders";
import { mockClient } from "aws-sdk-client-mock";

import { handler } from "../../../src/lambdas/orderRestock";

const db = mockClient(dbClient());

const mask = crypto.randomUUID();
const shield = crypto.randomUUID();

const order: Order = {
  id: crypto.randomUUID(),
  customerId: crypto.randomUUID(),
  address: { recipient: "Link", street: "1 Ordon Way", city: "Ordon", region: "Faron", postalCode: "12345" },
  paymentMethod: { brand: "Castle One", expirationMonth: 4, expirationYear: 2030, lastFour: "4242", token: "card-token" },
  orderDate: "2026-10-16T12:00:00.000Z",
  currentStatus: "Cancelled",
  statusUpdates: { Placed: "2026-10-16T12:00:00.000Z", Cancelled: "2026-10-16T12:00:10.000Z" },
  products: { [mask]: { amount: 2, pricePerUnit: 50 }, [shield]: { amount: 1, pricePerUnit: 200 } },
  shipping: { method: "Standard", cost: 0 }
};

const event = {
  detail: {
    orderId: order.id,
    customerId: order.customerId,
    previousStatus: "Placed",
    status: "Cancelled",
    at: "2026-10-16T12:00:10.000Z"
  }
} as Parameters<typeof handler>[0];

const storedOrder = (item: Partial<Order> = {}) => db.on(GetCommand).resolves({ Item: { ...order, ...item } });

const existingProducts = (...ids: string[]) =>
  db.on(BatchGetCommand).resolves({ Responses: { products: ids.map(id => ({ id })) } });

const cancelledTransaction = (...codes: string[]) =>
  new TransactionCanceledException({
    $metadata: {},
    message: "Transaction cancelled",
    CancellationReasons: codes.map(Code => ({ Code }))
  });

beforeEach(() => {
  db.reset();
  storedOrder();
  existingProducts(mask, shield);
  db.on(TransactWriteCommand).resolves({});
});

it("returns each product's stock and marks the order restocked in one transaction", async () => {
  await handler(event);

  expect(db).toHaveReceivedCommandWith(GetCommand, { TableName: "orders", Key: { id: order.id }, ConsistentRead: true });
  const [orderUpdate, ...productUpdates] = db.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
  expect(orderUpdate.Update).toEqual({
    TableName: "orders",
    Key: { id: order.id },
    ConditionExpression: "currentStatus = :cancelled AND attribute_not_exists(restockedAt)",
    UpdateExpression: "SET restockedAt = :now",
    ExpressionAttributeValues: { ":cancelled": "Cancelled", ":now": expect.any(String) }
  });
  expect(productUpdates.map(({ Update }) => Update)).toEqual(
    expect.arrayContaining([
      {
        TableName: "products",
        Key: { id: mask },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "SET stockCount = stockCount + :amount",
        ExpressionAttributeValues: { ":amount": 2 }
      },
      expect.objectContaining({ Key: { id: shield }, ExpressionAttributeValues: { ":amount": 1 } })
    ])
  );
  expect(productUpdates).toHaveLength(2);
});

it("skips products that were deleted since the order", async () => {
  existingProducts(shield);

  await handler(event);

  const [, ...productUpdates] = db.commandCalls(TransactWriteCommand)[0].args[0].input.TransactItems!;
  expect(productUpdates.map(({ Update }) => Update?.Key)).toEqual([{ id: shield }]);
});

it("does nothing for an order that was already restocked", async () => {
  storedOrder({ restockedAt: "2026-10-16T12:00:11.000Z" });

  await handler(event);

  expect(db).not.toHaveReceivedCommand(TransactWriteCommand);
});

it("does nothing for an order that isn't cancelled", async () => {
  storedOrder({ currentStatus: "Delivered" });

  await handler(event);

  expect(db).not.toHaveReceivedCommand(TransactWriteCommand);
});

it("does nothing for an order that no longer exists", async () => {
  db.on(GetCommand).resolves({});
  vi.spyOn(console, "warn").mockImplementation(() => undefined);

  await handler(event);

  expect(db).not.toHaveReceivedCommand(TransactWriteCommand);
});

it("treats a concurrent restock as done", async () => {
  db.on(TransactWriteCommand).rejects(cancelledTransaction("ConditionalCheckFailed", "None", "None"));

  await expect(handler(event)).resolves.toBeUndefined();
});

it("fails so it is retried when a product disappears mid-restock", async () => {
  db.on(TransactWriteCommand).rejects(cancelledTransaction("None", "ConditionalCheckFailed", "None"));

  await expect(handler(event)).rejects.toThrow(TransactionCanceledException);
});
