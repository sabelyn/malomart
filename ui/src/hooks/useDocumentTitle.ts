import { useEffect } from "react";

const SITE_NAME = "Malo Mart";

export const useDocumentTitle = (title?: string) => {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE_NAME}` : SITE_NAME;
  }, [title]);
};
