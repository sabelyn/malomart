import type { RefObject } from "react";
import { useRef, useState } from "react";

type DialogState<T> = { opened: boolean; target?: T };

export const useConfirmDialog = <T = undefined>(returnFocusRef: RefObject<HTMLElement | null>) => {
  const completedRef = useRef(false);
  const [{ opened, target }, setState] = useState<DialogState<T>>({ opened: false });

  const open = (next?: T) => setState({ opened: true, target: next });

  const close = () => setState(current => ({ ...current, opened: false }));

  const complete = () => {
    completedRef.current = true;
    close();
  };

  const afterClose = () => {
    if (completedRef.current) {
      completedRef.current = false;
      returnFocusRef.current?.focus();
    }
  };

  return { opened, target, open, close, complete, afterClose };
};
