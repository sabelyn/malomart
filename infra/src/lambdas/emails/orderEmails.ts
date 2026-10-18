import type { CancellationReason, Order, OrderStatus } from "@mm/lib/orders";
import { getOrderSubtotal, getOrderTotal, ShippingOptions } from "@mm/lib/orders";

export type NotifiedStatus = Exclude<OrderStatus, "Placed">;

export type OrderEmailInput = {
  status: NotifiedStatus;
  order: Order;
  recipientName?: string;
  orderUrl: string;
};

export type OrderEmail = {
  subject: string;
  html: string;
  text: string;
};

type Copy = { subject: string; heading: string; lines: string[] };

const copyFor = (status: NotifiedStatus, number: string, reason?: CancellationReason, shippingName?: string): Copy => {
  switch (status) {
    case "Confirmed":
      return {
        subject: `Order ${number} confirmed`,
        heading: "Payment went through.",
        lines: ["Your order is confirmed. It ships when it ships."]
      };
    case "Shipped":
      return {
        subject: `Order ${number} shipped`,
        heading: "It left.",
        lines: [`Your order is on its way by ${shippingName}. Don't watch the door.`]
      };
    case "Delivered":
      return {
        subject: `Order ${number} delivered`,
        heading: "Delivered.",
        lines: ["It's yours now. Try not to break it."]
      };
    case "Cancelled":
      return reason === "PaymentDeclined"
        ? {
            subject: `Order ${number} cancelled: payment declined`,
            heading: "Payment declined. Nothing ships.",
            lines: ["Your card didn't go through, so the order is cancelled.", "Check the card and try again."]
          }
        : {
            subject: `Order ${number} cancelled`,
            heading: "Cancelled.",
            lines: ["You cancelled it. Everything's back on the shelf."]
          };
  }
};

const rupees = (amount: number) => `${amount.toLocaleString("en-US")} rupees`;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`);

export const orderNumber = (order: Pick<Order, "id">) => order.id.slice(0, 8).toUpperCase();

export const renderOrderEmail = ({ status, order, recipientName, orderUrl }: OrderEmailInput): OrderEmail => {
  const number = orderNumber(order);
  const shipping = ShippingOptions[order.shipping.method];
  const { subject, heading, lines } = copyFor(status, number, order.cancellationReason, shipping.name);
  const greeting = recipientName ? `${recipientName},` : undefined;
  const items = Object.values(order.products).map(({ title, amount, pricePerUnit }) => ({
    title,
    amount,
    total: amount * pricePerUnit
  }));
  const summary = [
    `Subtotal: ${rupees(getOrderSubtotal(order.products))}`,
    `Shipping (${shipping.name}): ${order.shipping.cost === 0 ? "Free" : rupees(order.shipping.cost)}`,
    `Total: ${rupees(getOrderTotal(order))}`
  ];

  const text = [
    ...(greeting ? [greeting, ""] : []),
    heading,
    ...lines,
    "",
    `Order ${number}`,
    ...items.map(({ title, amount, total }) => `- ${title} x${amount}: ${rupees(total)}`),
    "",
    ...summary,
    "",
    `View your order: ${orderUrl}`,
    "",
    "- Malo"
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:24px 16px;background:#f7f1e3;color:#2b1a1f;font-family:Inter,Helvetica,Arial,sans-serif;line-height:1.5">
<main style="max-width:560px;margin:0 auto;background:#ffffff;border:2px solid #b8975a;border-radius:8px;padding:24px">
<p style="margin:0 0 16px;color:#c2477a;font-weight:700;font-size:20px">Malo Mart</p>
${greeting ? `<p style="margin:0 0 8px">${escapeHtml(greeting)}</p>` : ""}
<h1 style="margin:0 0 8px;font-size:24px">${escapeHtml(heading)}</h1>
${lines.map(line => `<p style="margin:0 0 8px">${escapeHtml(line)}</p>`).join("\n")}
<h2 style="margin:24px 0 8px;font-size:18px">Order ${number}</h2>
<ul style="margin:0 0 16px;padding-left:20px">
${items.map(({ title, amount, total }) => `<li>${escapeHtml(title)} x${amount}: ${rupees(total)}</li>`).join("\n")}
</ul>
${summary.map(line => `<p style="margin:0">${escapeHtml(line)}</p>`).join("\n")}
<p style="margin:24px 0"><a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#edc04e;color:#2b1a1f;font-weight:700;padding:10px 18px;border-radius:6px;text-decoration:none">View your order</a></p>
<p style="margin:0">Malo</p>
</main>
</body>
</html>`;

  return { subject, html, text };
};
