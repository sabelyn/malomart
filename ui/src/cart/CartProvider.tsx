import { VisuallyHidden } from "@mantine/core";
import { customers, getCustomer, updateCart } from "@mm/lib/customers";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { apiCall, routeKey, useSession } from "@/api";
import { addItems, applyQuantities, countItems, isEmptyCart } from "./cartItems";
import type { CartItems } from "./guestCart";
import { readGuestCart, subscribeGuestCart, writeGuestCart } from "./guestCart";

export type CartProduct = { id: string; title: string; stockCount: number };

type Quantities = Record<string, number>;

type CartContextValue = {
  items: CartItems;
  count: number;
  ready: boolean;
  loadFailed: boolean;
  saveFailed: boolean;
  adjustments: Quantities;
  add: (product: CartProduct) => void;
  setQuantity: (productId: string, amount: number) => void;
  remove: (productId: string) => void;
  adjust: (quantities: Quantities) => void;
  clearAdjustments: () => void;
  retryLoad: () => void;
  announce: (message: string) => void;
};

type SaveInput = { userId: string; items: CartItems; mergedGuestCart?: boolean };

const EMPTY: CartItems = {};

const CART_MUTATION_KEY = [...routeKey(customers), "cart", "save"];

export const serverCartQuery = (userId: string) =>
  queryOptions({
    queryKey: [...routeKey(customers), "cart", userId],
    queryFn: async ({ signal }) => (await apiCall(getCustomer, {}, { signal })).cart
  });

const CartContext = createContext<CartContextValue | null>(null);

export const useCart = () => {
  const cart = useContext(CartContext);
  if (!cart) {
    throw new Error("useCart must be used inside a CartProvider.");
  }
  return cart;
};

const itemsWord = (count: number) => (count === 1 ? "item" : "items");

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: user, isPending: sessionPending } = useSession();
  const userId = user?.id;
  const guestItems = useSyncExternalStore(subscribeGuestCart, readGuestCart);
  const serverCart = useQuery({ ...serverCartQuery(userId ?? ""), enabled: !!userId });
  const [adjusted, setAdjusted] = useState<{ userId?: string; quantities: Quantities }>({ quantities: {} });
  const [saveFailed, setSaveFailed] = useState(false);
  const [announcement, setAnnouncement] = useState({ id: 0, message: "" });
  const mergedFor = useRef<string>(undefined);

  const adjustments = adjusted.userId === userId ? adjusted.quantities : EMPTY;

  const addAdjustments = (forUser: string | undefined, quantities: Quantities) =>
    setAdjusted(current => ({
      userId: forUser,
      quantities: current.userId === forUser ? { ...current.quantities, ...quantities } : quantities
    }));

  const announce = (message: string) => setAnnouncement(current => ({ id: current.id + 1, message }));

  const save = useMutation({
    mutationKey: CART_MUTATION_KEY,
    scope: { id: "cart" },
    mutationFn: ({ items }: SaveInput) => apiCall(updateCart, { body: items }),
    onSuccess: (reduced, { userId: savedFor, mergedGuestCart }) => {
      if (mergedGuestCart) {
        writeGuestCart({});
      }
      if (isEmptyCart(reduced)) {
        return;
      }
      queryClient.setQueryData(serverCartQuery(savedFor).queryKey, current =>
        current ? applyQuantities(current, reduced) : current
      );
      addAdjustments(savedFor, reduced);
    },
    onError: async (_, { userId: savedFor }) => {
      setSaveFailed(true);
      if (queryClient.isMutating({ mutationKey: CART_MUTATION_KEY }) === 1) {
        await queryClient.invalidateQueries({ queryKey: serverCartQuery(savedFor).queryKey });
      }
    }
  });

  const saveServerCart = (forUser: string, next: CartItems, mergedGuestCart?: boolean) => {
    const { queryKey } = serverCartQuery(forUser);
    void queryClient.cancelQueries({ queryKey });
    queryClient.setQueryData(queryKey, next);
    save.mutate({ userId: forUser, items: next, mergedGuestCart });
  };

  const update = (updater: (items: CartItems) => CartItems) => {
    setSaveFailed(false);
    if (!userId) {
      writeGuestCart(updater(readGuestCart()));
      return true;
    }
    const current = queryClient.getQueryData(serverCartQuery(userId).queryKey);
    if (!current) {
      return false;
    }
    saveServerCart(userId, updater(current));
    return true;
  };

  const serverItems = serverCart.data;
  useEffect(() => {
    if (!userId || !serverItems || mergedFor.current === userId || isEmptyCart(guestItems)) {
      return;
    }
    mergedFor.current = userId;
    saveServerCart(userId, addItems(serverItems, guestItems), true);
  });

  const items = userId ? (serverItems ?? EMPTY) : guestItems;
  const count = countItems(items);
  const ready = !sessionPending && (!userId || serverItems !== undefined);

  const add = (product: CartProduct) => {
    if (!ready) {
      announce("Your cart is still loading. Try again in a moment.");
      return;
    }
    if ((items[product.id] ?? 0) >= product.stockCount) {
      announce(`Your cart already has every ${product.title} in stock.`);
      return;
    }
    const added = update(current => ({
      ...current,
      [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stockCount)
    }));
    if (added) {
      announce(`Added ${product.title} to your cart. ${count + 1} ${itemsWord(count + 1)} in cart.`);
    }
  };

  const value: CartContextValue = {
    items,
    count,
    ready,
    loadFailed: !!userId && serverCart.isError,
    saveFailed,
    adjustments,
    add,
    setQuantity: (productId, amount) => update(current => ({ ...current, [productId]: amount })),
    remove: productId => update(current => applyQuantities(current, { [productId]: 0 })),
    adjust: quantities => {
      if (update(current => applyQuantities(current, quantities))) {
        addAdjustments(userId, quantities);
      }
    },
    clearAdjustments: () => setAdjusted({ quantities: {} }),
    retryLoad: () => void serverCart.refetch(),
    announce
  };

  return (
    <CartContext.Provider value={value}>
      {children}
      <VisuallyHidden aria-live="polite" aria-atomic="true">
        <span key={announcement.id}>{announcement.message}</span>
      </VisuallyHidden>
    </CartContext.Provider>
  );
};
