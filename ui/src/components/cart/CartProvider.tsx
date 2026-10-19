import { customers, getCustomer, updateCart } from "@mm/lib/customers";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { apiCall, routeKey, useSession } from "@/api";
import { toasts } from "@/copy";
import { addItems, applyQuantities, countItems, isEmptyCart } from "@/utils/cartItems";
import type { CartItems } from "@/utils/guestCart";
import { readGuestCart, subscribeGuestCart, writeGuestCart } from "@/utils/guestCart";
import { notify } from "@/utils/notify";

export type CartProduct = { id: string; title: string; stockCount: number };

type Quantities = Record<string, number>;

type CartContextValue = {
  items: CartItems;
  count: number;
  ready: boolean;
  loadFailed: boolean;
  adjustments: Quantities;
  add: (product: CartProduct) => void;
  subtract: (product: CartProduct) => void;
  setQuantity: (productId: string, amount: number) => void;
  remove: (productId: string) => void;
  adjust: (quantities: Quantities) => void;
  clearAdjustments: () => void;
  retryLoad: () => void;
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

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const { data: user, isPending: sessionPending } = useSession();
  const userId = user?.id;
  const guestItems = useSyncExternalStore(subscribeGuestCart, readGuestCart);
  const serverCart = useQuery({ ...serverCartQuery(userId ?? ""), enabled: !!userId });
  const [adjusted, setAdjusted] = useState<{ userId?: string; quantities: Quantities }>({ quantities: {} });
  const mergedFor = useRef<string>(undefined);

  const adjustments = adjusted.userId === userId ? adjusted.quantities : EMPTY;

  const addAdjustments = (forUser: string | undefined, quantities: Quantities) =>
    setAdjusted(current => ({
      userId: forUser,
      quantities: current.userId === forUser ? { ...current.quantities, ...quantities } : quantities
    }));

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
      notify({ tone: "error", title: toasts.cart.saveFailedTitle, message: toasts.cart.saveFailed });
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
      notify({ tone: "info", message: toasts.cart.stillLoading });
      return;
    }
    const amount = items[product.id] ?? 0;
    if (amount >= product.stockCount) {
      notify({ tone: "info", message: toasts.cart.allInStock(product.title) });
      return;
    }
    const added = update(current => ({
      ...current,
      [product.id]: Math.min((current[product.id] ?? 0) + 1, product.stockCount)
    }));
    if (added) {
      notify({ message: toasts.cart.added(product.title, amount + 1) });
    }
  };

  const subtract = (product: CartProduct) => {
    const amount = items[product.id] ?? 0;
    if (amount === 0) {
      return;
    }
    if (update(current => applyQuantities(current, { [product.id]: (current[product.id] ?? 0) - 1 }))) {
      notify({
        message: amount === 1 ? toasts.cart.removed(product.title) : toasts.cart.removedOne(product.title, amount - 1)
      });
    }
  };

  const value: CartContextValue = {
    items,
    count,
    ready,
    loadFailed: !!userId && serverCart.isError,
    adjustments,
    add,
    subtract,
    setQuantity: (productId, amount) => update(current => ({ ...current, [productId]: amount })),
    remove: productId => update(current => applyQuantities(current, { [productId]: 0 })),
    adjust: quantities => {
      if (update(current => applyQuantities(current, quantities))) {
        addAdjustments(userId, quantities);
      }
    },
    clearAdjustments: () => setAdjusted({ quantities: {} }),
    retryLoad: () => void serverCart.refetch()
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};
