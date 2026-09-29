const PLACEHOLDER_ORIGIN = "http://return-to.invalid";

export const safeReturnTo = (value: unknown, fallback = "/") => {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return fallback;
  }

  let url: URL;
  try {
    url = new URL(value, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }

  if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname === "/api" || url.pathname.startsWith("/api/")) {
    return fallback;
  }
  return `${url.pathname}${url.search}${url.hash}`;
};
