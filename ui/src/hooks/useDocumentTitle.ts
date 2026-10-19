import { useEffect } from "react";

import { ui } from "@/copy";

export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ${ui.site.name}` : ui.site.name;
  }, [title]);
};
