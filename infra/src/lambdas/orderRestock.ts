import { TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient, getItemsByIds } from "@mm/clients/db";
import { Order, OrderStatus, OrderStatusChangedDetail } from "@mm/lib/orders";
import type { EventBridgeEvent } from "aws-lambda";

const { ORDERS_TABLE_NAME, PRODUCTS_TABLE_NAME } = process.env;

const db = dbClient();

export const handler = async (event: EventBridgeEvent<"OrderStatusChanged", OrderStatusChangedDetail>) => {
  const { orderId } = OrderStatusChangedDetail.parse(event.detail);

  const { Item } = await db.send(
    new GetCommand({ TableName: ORDERS_TABLE_NAME, Key: { id: orderId }, ConsistentRead: true })
  );
  if (!Item) {
    console.warn(`Order ${orderId} no longer exists, nothing to restock.`);
    return;
  }
  const order = Order.parse(Item);
  if (order.restockedAt || order.currentStatus !== OrderStatus.Cancelled) {
    return;
  }

  const existing = await getItemsByIds<{ id: string }>(db, PRODUCTS_TABLE_NAME!, Object.keys(order.products), "id");

  try {
    await db.send(
      new TransactWriteCommand({
        TransactItems: [
          {
            Update: {
              TableName: ORDERS_TABLE_NAME,
              Key: { id: orderId },
              ConditionExpression: "currentStatus = :cancelled AND attribute_not_exists(restockedAt)",
              UpdateExpression: "SET restockedAt = :now",
              ExpressionAttributeValues: { ":cancelled": OrderStatus.Cancelled, ":now": new Date().toISOString() }
            }
          },
          ...existing.map(({ id }) => ({
            Update: {
              TableName: PRODUCTS_TABLE_NAME,
              Key: { id },
              ConditionExpression: "attribute_exists(id)",
              UpdateExpression: "SET stockCount = stockCount + :amount",
              ExpressionAttributeValues: { ":amount": order.products[id].amount }
            }
          }))
        ]
      })
    );
  } catch (err) {
    const alreadyRestocked =
      err instanceof TransactionCanceledException && err.CancellationReasons?.[0]?.Code === "ConditionalCheckFailed";
    if (!alreadyRestocked) {
      throw err;
    }
  }
};
