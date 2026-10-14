import { getOrderTotal } from "../../../src/orders";

describe("getOrderTotal", () => {
  it("returns 0 for an order with no products", () => {
    expect(getOrderTotal({})).toBe(0);
  });

  it("multiplies the amount by the price for a single product", () => {
    expect(getOrderTotal({ a: { amount: 3, pricePerUnit: 25 } })).toBe(75);
  });

  it("sums the line totals across products", () => {
    expect(
      getOrderTotal({
        a: { amount: 2, pricePerUnit: 50 },
        b: { amount: 1, pricePerUnit: 5 },
        c: { amount: 4, pricePerUnit: 120 }
      })
    ).toBe(585);
  });
});
