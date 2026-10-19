import type { Order } from "@mm/lib/orders";

import { renderOrderEmail } from "../../../src/lambdas/emails/orderEmails";

const mask = crypto.randomUUID();
const nuts = crypto.randomUUID();

const order: Order = {
  id: crypto.randomUUID(),
  entityType: "Order",
  customerId: crypto.randomUUID(),
  address: { recipient: "Link", street: "1 Ordon Way", city: "Ordon", region: "Faron", postalCode: "12345" },
  paymentMethod: {
    brand: "Castle One",
    expirationMonth: 4,
    expirationYear: 2030,
    lastFour: "4242",
    token: "card-token"
  },
  orderDate: "2026-10-16T12:00:00.000Z",
  currentStatus: "Delivered",
  statusUpdates: { Placed: "2026-10-16T12:00:00.000Z" },
  products: {
    [mask]: { title: "<Mask> & Co", amount: 1, pricePerUnit: 1500 },
    [nuts]: { title: "Deku Nut", amount: 3, pricePerUnit: 10 }
  },
  shipping: { method: "Standard", cost: 0 }
};

const render = (recipientName?: string) =>
  renderOrderEmail({
    status: "Delivered",
    order,
    recipientName,
    orderUrl: "https://malomart.test/orders/1?a=b&c=d"
  });

it("lists items by the titles saved on the order and shows free shipping", () => {
  const { text } = render();

  expect(text).toContain("Deku Nut x3: 30 rupees");
  expect(text).toContain("Shipping (Postman Standard): Free");
  expect(text).toContain("Total: 1,530 rupees");
});

it("escapes customer and product text in the HTML", () => {
  const { html } = render("<b>Link</b>");

  expect(html).toContain("&#60;Mask&#62; &#38; Co");
  expect(html).toContain("&#60;b&#62;Link&#60;/b&#62;,");
  expect(html).toContain('href="https://malomart.test/orders/1?a=b&#38;c=d"');
  expect(html).not.toContain("<b>Link</b>");
});

it("greets the customer by name when known", () => {
  expect(render("Link").text.startsWith("Link,\n")).toBe(true);
  expect(render().text.startsWith("Delivered.")).toBe(true);
});
