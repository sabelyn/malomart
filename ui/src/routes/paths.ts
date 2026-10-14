export const SIGN_IN_PATH = "/auth/sign-in";
export const SIGN_UP_PATH = "/auth/sign-up";

export type SignInState = {
  email?: string;
  notice?: string;
};

const withReturnTo = (path: string, returnTo?: string) =>
  returnTo && returnTo !== "/" && !returnTo.startsWith("/auth") ? `${path}?${new URLSearchParams({ returnTo })}` : path;

export const signInPath = (returnTo?: string) => withReturnTo(SIGN_IN_PATH, returnTo);

export const signUpPath = (returnTo?: string) => withReturnTo(SIGN_UP_PATH, returnTo);
