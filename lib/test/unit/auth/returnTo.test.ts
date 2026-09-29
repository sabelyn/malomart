import { safeReturnTo } from "../../../src/auth";

describe("safeReturnTo", () => {
  it.each([
    ["a root path", "/", "/"],
    ["a nested path", "/orders/123", "/orders/123"],
    ["a path with a query and hash", "/products?category=Masks#top", "/products?category=Masks#top"],
    ["a path that normalizes dot segments", "/products/../orders", "/orders"],
    ["a path that merely starts with api", "/apiary", "/apiary"]
  ])("keeps %s", (_, value, expected) => {
    expect(safeReturnTo(value)).toBe(expected);
  });

  it.each([
    ["undefined", undefined],
    ["null", null],
    ["a non-string", 42],
    ["an empty string", ""],
    ["a relative path", "orders"],
    ["an absolute URL", "https://evil.example/orders"],
    ["a protocol-relative URL", "//evil.example/orders"],
    ["a backslash host", "/\\evil.example"],
    ["a tab-smuggled host", "/\t/evil.example"],
    ["a javascript URL", "javascript:alert(1)"],
    ["the api root", "/api"],
    ["an api path", "/api/auth/sign-out"],
    ["an api path reached through dot segments", "/products/../api/auth/me"]
  ])("rejects %s", (_, value) => {
    expect(safeReturnTo(value)).toBe("/");
  });

  it("uses the given fallback", () => {
    expect(safeReturnTo("//evil.example", "/products")).toBe("/products");
  });
});
