import { UpdateCartBody } from "@mm/lib/customers";

export type CartItems = UpdateCartBody;

export const GUEST_CART_KEY = "mm.cart";

const EMPTY: CartItems = {};
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cached: CartItems = EMPTY;

const parse = (raw: string | null) => {
  if (!raw) {
    return EMPTY;
  }
  try {
    const result = UpdateCartBody.safeParse(JSON.parse(raw));
    return result.success ? result.data : EMPTY;
  } catch {
    return EMPTY;
  }
};

const readRaw = () => {
  try {
    return localStorage.getItem(GUEST_CART_KEY);
  } catch {
    return undefined;
  }
};

const notify = () => listeners.forEach(listener => listener());

export const readGuestCart = (): CartItems => {
  const raw = readRaw();
  if (raw !== undefined && raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
};

const persist = (raw: string | null) => {
  try {
    if (raw) {
      localStorage.setItem(GUEST_CART_KEY, raw);
    } else {
      localStorage.removeItem(GUEST_CART_KEY);
    }
    return true;
  } catch {
    return false;
  }
};

export const writeGuestCart = (items: CartItems) => {
  const raw = Object.keys(items).length > 0 ? JSON.stringify(items) : null;
  cachedRaw = raw;
  cached = raw ? items : EMPTY;
  persist(raw);
  notify();
};

const onStorage = (event: StorageEvent) => {
  if (event.key === GUEST_CART_KEY || event.key === null) {
    notify();
  }
};

export const subscribeGuestCart = (listener: () => void) => {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
};
