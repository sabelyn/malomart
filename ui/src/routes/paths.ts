export const SIGN_IN_PATH = "/auth/sign-in";
export const SIGN_UP_PATH = "/auth/sign-up";

export type SignInState = {
  email?: string;
  notice?: string;
};

export const signInPath = (returnTo?: string) =>
  returnTo && returnTo !== "/" && !returnTo.startsWith("/auth") ? `${SIGN_IN_PATH}?${new URLSearchParams({ returnTo })}` : SIGN_IN_PATH;
