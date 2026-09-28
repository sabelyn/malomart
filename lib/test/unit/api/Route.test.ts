import { Route } from "../../../src/api";

describe("Route", () => {
  it("defaults access to user with no tags or parent", () => {
    const route = new Route("/things");

    expect(route.access).toBe("user");
    expect(route.tags.size).toBe(0);
    expect(route.parent).toBeUndefined();
    expect(route.fullPath).toBe("/things");
  });

  it("builds the full path from its ancestors", () => {
    const root = new Route("/a");
    const middle = new Route("/b", "user", [], root);
    const leaf = new Route("/c", "user", [], middle);

    expect(leaf.fullPath).toBe("/a/b/c");
  });

  it("strips a trailing slash from the full path", () => {
    const root = new Route("/products");
    const child = new Route("/", "user", [], root);

    expect(child.fullPath).toBe("/products");
  });

  it("collapses repeated slashes in the full path", () => {
    const root = new Route("/a/");
    const child = new Route("/b", "user", [], root);

    expect(child.fullPath).toBe("/a/b");
  });

  it("does not leave a trailing slash when both segments end in one", () => {
    const root = new Route("/a/");
    const child = new Route("/", "user", [], root);

    expect(child.fullPath).toBe("/a");
  });

  it("converts path params to express syntax using only its own path", () => {
    const root = new Route("/products");
    const child = new Route("/{id}/reviews/{reviewId}", "user", [], root);

    expect(child.expressPath).toBe("/:id/reviews/:reviewId");
  });

  it("leaves express path unchanged when there are no params", () => {
    expect(new Route("/products").expressPath).toBe("/products");
  });

  it("inherits tags from all ancestors", () => {
    const root = new Route("/a", "user", ["Products"]);
    const middle = new Route("/b", "user", [], root);
    const leaf = new Route("/c", "user", [], middle);

    expect([...leaf.tags]).toEqual(["Products"]);
  });

  it("does not push its tags up to the parent", () => {
    const root = new Route("/a");
    new Route("/b", "user", ["Products"], root);

    expect(root.tags.size).toBe(0);
  });

  it("registers itself as a child of its parent", () => {
    const root = new Route("/a");
    const child = new Route("/b", "user", [], root);

    expect([...root.children]).toEqual([child]);
  });

  it("adds routes to its children", () => {
    const root = new Route("/a");
    const other = new Route("/b");

    root.addRoute(other);

    expect(root.children.has(other)).toBe(true);
  });
});
