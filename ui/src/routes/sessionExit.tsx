import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { To } from "react-router";
import { useLocation, useNavigate } from "react-router";

import { useClearSession } from "@/api";

type ExitStore = {
  get: () => boolean;
  set: (exiting: boolean) => void;
  subscribe: (listener: () => void) => () => void;
};

const createExitStore = (): ExitStore => {
  let exiting = false;
  const listeners = new Set<() => void>();
  return {
    get: () => exiting,
    set: next => {
      if (next !== exiting) {
        exiting = next;
        listeners.forEach(listener => listener());
      }
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };
};

const ExitContext = createContext<ExitStore | null>(null);

export const SessionExitProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(createExitStore);
  const { key } = useLocation();

  useEffect(() => store.set(false), [store, key]);

  return <ExitContext.Provider value={store}>{children}</ExitContext.Provider>;
};

const noExits = createExitStore();

export const useSessionExiting = () => {
  const store = useContext(ExitContext) ?? noExits;
  return useSyncExternalStore(store.subscribe, store.get);
};

export const useExitSession = () => {
  const store = useContext(ExitContext);
  const navigate = useNavigate();
  const clearSession = useClearSession();

  return (to: To, state?: unknown) => {
    store?.set(true);
    void navigate(to, { state });
    clearSession();
  };
};
