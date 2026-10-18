import type { DurableContext } from "@aws/durable-execution-sdk-js";
import { withDurableExecution } from "@aws/durable-execution-sdk-js";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dbClient } from "@mm/clients/db";
import { invoke, lambdaClient } from "@mm/clients/lambda";
import type { ChargeCardEvent } from "@mm/lib/lambdas";
import { ChargeCardResult } from "@mm/lib/lambdas";
import type { OrderStatusChangedDetail, SecondsRange, ShippingMethod } from "@mm/lib/orders";
import {
  CancellationReason,
  getOrderTotal,
  Order,
  OrderStatus,
  PAYMENT_SECONDS,
  ShippingOptions
} from "@mm/lib/orders";
import type { EventBridgeEvent } from "aws-lambda";

const { CHARGE_CARD_FUNCTION_NAME, ORDERS_TABLE_NAME, TIME_SCALE } = process.env;

const db = dbClient();

type FulfillmentEvent = EventBridgeEvent<"OrderStatusChanged", OrderStatusChangedDetail>;

type ClaimedOrder = Omit<ChargeCardEvent, "orderId"> & { shippingMethod: ShippingMethod };

const isConditionFailure = (err: unknown) => err instanceof Error && err.name === "ConditionalCheckFailedException";

const claim = async (id: string): Promise<ClaimedOrder | null> => {
  try {
    const { Attributes } = await db.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE_NAME,
        Key: { id },
        ConditionExpression: "currentStatus = :placed AND attribute_not_exists(fulfillmentToken)",
        UpdateExpression: "SET fulfillmentToken = :token",
        ExpressionAttributeValues: { ":placed": OrderStatus.Placed, ":token": crypto.randomUUID() },
        ReturnValues: "ALL_NEW"
      })
    );
    const order = Order.parse(Attributes);
    return {
      customerId: order.customerId,
      token: order.paymentMethod.token,
      amount: getOrderTotal(order),
      shippingMethod: order.shipping.method
    };
  } catch (err) {
    if (isConditionFailure(err)) {
      return null;
    }
    throw err;
  }
};

const scaledBetween = ([min, max]: SecondsRange) =>
  Math.max(1, Math.round((min + Math.random() * (max - min)) * Number(TIME_SCALE ?? 1)));

const planTimeline = (shippingMethod: ShippingMethod) => {
  const { shipSeconds, deliverSeconds } = ShippingOptions[shippingMethod].fulfillment;
  const ship = scaledBetween(shipSeconds);
  const deliver = scaledBetween(deliverSeconds);
  return {
    paymentSeconds: scaledBetween(PAYMENT_SECONDS),
    shipSeconds: ship,
    transitSeconds: Math.max(1, deliver - ship)
  };
};

const chargeCard = async (orderId: string, { customerId, token, amount }: ClaimedOrder) => {
  const result = await invoke<ChargeCardEvent, typeof ChargeCardResult>(
    lambdaClient(),
    CHARGE_CARD_FUNCTION_NAME!,
    { orderId, customerId, token, amount },
    ChargeCardResult
  );
  if ("errorName" in result) {
    throw new Error(`Charging the card failed with ${result.errorName}.`);
  }
  return result;
};

const transition = async (id: string, from: OrderStatus, to: OrderStatus, cancellationReason?: CancellationReason) => {
  try {
    await db.send(
      new UpdateCommand({
        TableName: ORDERS_TABLE_NAME,
        Key: { id },
        ConditionExpression: "currentStatus = :from",
        UpdateExpression: `SET currentStatus = :to, statusUpdates.#to = :now${cancellationReason ? ", cancellationReason = :reason" : ""}`,
        ExpressionAttributeNames: { "#to": to },
        ExpressionAttributeValues: {
          ":from": from,
          ":to": to,
          ":now": new Date().toISOString(),
          ...(cancellationReason ? { ":reason": cancellationReason } : {})
        }
      })
    );
    return true;
  } catch (err) {
    if (isConditionFailure(err)) {
      return false;
    }
    throw err;
  }
};

export const handler = withDurableExecution(async (event: FulfillmentEvent, context: DurableContext) => {
  const { orderId } = event.detail;

  const order = await context.step("claim", () => claim(orderId));
  if (!order) {
    return { orderId, status: null };
  }

  const timeline = await context.step("plan-timeline", () => Promise.resolve(planTimeline(order.shippingMethod)));

  await context.wait("payment-processing", { seconds: timeline.paymentSeconds });
  const charge = await context.step("charge-payment", () => chargeCard(orderId, order));
  if (!charge.approved) {
    const declined = await context.step("decline", () =>
      transition(orderId, OrderStatus.Placed, OrderStatus.Cancelled, CancellationReason.PaymentDeclined)
    );
    return { orderId, status: declined ? OrderStatus.Cancelled : null };
  }

  if (!(await context.step("confirm", () => transition(orderId, OrderStatus.Placed, OrderStatus.Confirmed)))) {
    return { orderId, status: null };
  }

  await context.wait("awaiting-shipment", { seconds: timeline.shipSeconds });
  if (!(await context.step("ship", () => transition(orderId, OrderStatus.Confirmed, OrderStatus.Shipped)))) {
    return { orderId, status: OrderStatus.Confirmed };
  }

  await context.wait("in-transit", { seconds: timeline.transitSeconds });
  const delivered = await context.step("deliver", () =>
    transition(orderId, OrderStatus.Shipped, OrderStatus.Delivered)
  );
  return { orderId, status: delivered ? OrderStatus.Delivered : OrderStatus.Shipped };
});
