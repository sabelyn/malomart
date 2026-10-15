import { getOrderItemCount, getOrderSubtotal, getOrderTotal } from "../../../src/orders";

describe("getOrderSubtotal", () => {
  it("returns 0 for an order with no products", () => {
    expect(getOrderSubtotal({})).toBe(0);
  });

  it("multiplies the amount by the price for a single product", () => {
    expect(getOrderSubtotal({ a: { amount: 3, pricePerUnit: 25 } })).toBe(75);
  });

  it("sums the line totals across products", () => {
    expect(
      getOrderSubtotal({
        a: { amount: 2, pricePerUnit: 50 },
        b: { amount: 1, pricePerUnit: 5 },
        c: { amount: 4, pricePerUnit: 120 }
      })
    ).toBe(585);
  });
});

describe("getOrderTotal", () => {
  it("adds the shipping cost to the subtotal", () => {
    expect(
      getOrderTotal({
        products: { a: { amount: 2, pricePerUnit: 50 } },
        shipping: { method: "Express", cost: 40 }
      })
    ).toBe(140);
  });
});

describe("getOrderItemCount", () => {
  it("sums the amounts across products", () => {
    expect(
      getOrderItemCount({
        a: { amount: 2, pricePerUnit: 50 },
        b: { amount: 3, pricePerUnit: 5 }
      })
    ).toBe(5);
  });
});
