import { ListProductsQuery } from "@mm/lib/products";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigationType } from "react-router";

import { useSchemaSearch } from "@/hooks/useSchemaSearch";

const Filters = ListProductsQuery.omit({ cursor: true });

const renderSearch = (route: string) =>
  renderHook(
    () => {
      const [values, update] = useSchemaSearch(Filters);
      const { search } = useLocation();
      return { values, update, search, navigationType: useNavigationType() };
    },
    { wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> }
  );

describe("useSchemaSearch", () => {
  it("parses search params with the schema, applying defaults", () => {
    const { result } = renderSearch("/products?category=Masks&inStock=true");

    expect(result.current.values).toEqual({ category: "Masks", inStock: true, limit: 20 });
  });

  it("drops invalid params instead of failing", () => {
    const { result } = renderSearch("/products?category=Toasters&limit=50");

    expect(result.current.values).toEqual({ limit: 50 });
  });

  it("ignores params the schema doesn't know about", () => {
    const { result } = renderSearch("/products?utm_source=flyer");

    expect(result.current.values).toEqual({ limit: 20 });
  });

  it("merges updates into the URL without adding history entries", () => {
    const { result } = renderSearch("/products?category=Masks");

    act(() => result.current.update({ inStock: true }));

    expect(new URLSearchParams(result.current.search).toString()).toBe("category=Masks&inStock=true");
    expect(result.current.navigationType).toBe("REPLACE");
    expect(result.current.values).toEqual({ category: "Masks", inStock: true, limit: 20 });
  });

  it("removes cleared and default values from the URL", () => {
    const { result } = renderSearch("/products?category=Masks&limit=50&ref=home");

    act(() => result.current.update({ category: undefined, limit: 20 }));

    expect(result.current.search).toBe("?ref=home");
  });
});
