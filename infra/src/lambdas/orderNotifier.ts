import { AdminGetUserCommand, CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";
import { dbClient, getItemById, getItemsByIds } from "@mm/clients/db";
import { Order, OrderStatus, OrderStatusChangedDetail } from "@mm/lib/orders";
import type { EventBridgeEvent } from "aws-lambda";

import type { NotifiedStatus } from "./emails/orderEmails";
import { renderOrderEmail } from "./emails/orderEmails";

const { APP_ORIGIN, EMAIL_FROM, ORDERS_TABLE_NAME, PRODUCTS_TABLE_NAME, USER_POOL_ID } = process.env;

const db = dbClient();
const cognito = new CognitoIdentityProviderClient({});
const ses = new SESv2Client({});

const isNotified = (status: OrderStatus): status is NotifiedStatus => status !== OrderStatus.Placed;

const getRecipient = async (customerId: string) => {
  try {
    const { UserAttributes } = await cognito.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: customerId })
    );
    const attribute = (name: string) => UserAttributes?.find(a => a.Name === name)?.Value;
    const email = attribute("email");
    return email ? { email, name: attribute("name") } : null;
  } catch (err) {
    if (err instanceof Error && err.name === "UserNotFoundException") {
      return null;
    }
    throw err;
  }
};

export const handler = async (event: EventBridgeEvent<"OrderStatusChanged", OrderStatusChangedDetail>) => {
  const { orderId, customerId, status } = OrderStatusChangedDetail.parse(event.detail);
  if (!isNotified(status)) {
    return;
  }

  const [item, recipient] = await Promise.all([getItemById(db, ORDERS_TABLE_NAME!, orderId), getRecipient(customerId)]);
  if (!item) {
    console.warn(`Order ${orderId} no longer exists, skipping the ${status} email.`);
    return;
  }
  if (!recipient) {
    console.warn(`Customer ${customerId} has no email, skipping the ${status} email for order ${orderId}.`);
    return;
  }

  const order = Order.parse(item);
  const products = await getItemsByIds<{ id: string; title: string }>(
    db,
    PRODUCTS_TABLE_NAME!,
    Object.keys(order.products),
    "id, title"
  );
  const { subject, html, text } = renderOrderEmail({
    status,
    order,
    titles: Object.fromEntries(products.map(({ id, title }) => [id, title])),
    recipientName: recipient.name,
    orderUrl: `${APP_ORIGIN}/orders/${orderId}`
  });

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: EMAIL_FROM,
        Destination: { ToAddresses: [recipient.email] },
        Content: {
          Simple: {
            Subject: { Data: subject },
            Body: { Html: { Data: html }, Text: { Data: text } }
          }
        }
      })
    );
  } catch (err) {
    if (err instanceof Error && err.name === "MessageRejected") {
      console.warn(`SES rejected the ${status} email for order ${orderId}.`, err);
      return;
    }
    throw err;
  }
};
