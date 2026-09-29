import { apiRoot, Endpoint, Route } from "../api";
import { ConfirmSignUpBody, SignInBody, SignUpBody, VerifySignInBody } from "./requests";
import { ConfirmSignUpResponse, CurrentUser } from "./responses";

export const auth = new Route("/auth", "public", ["Auth"], apiRoot);

export const signUp = new Endpoint(auth, {
  bodySchema: SignUpBody,
  description: "Registers a new account without a password and emails the user a confirmation code.",
  errors: {
    400: "The email or name was invalid.",
    409: "An account already exists for this email.",
    429: "Too many sign-up attempts. Try again later."
  },
  id: "signUp",
  method: "POST",
  path: "/sign-up",
  successDescription: "The account was created and a confirmation code was sent.",
  successStatus: "202",
  summary: "Sign Up"
});

export const confirmSignUp = new Endpoint(auth, {
  bodySchema: ConfirmSignUpBody,
  description:
    "Confirms a new account with the emailed code. When the sign-up session is still valid, the user is signed in and session cookies are set.",
  errors: {
    400: "The code was invalid or expired.",
    429: "Too many attempts. Try again later."
  },
  id: "confirmSignUp",
  method: "POST",
  path: "/sign-up/confirm",
  responseSchema: ConfirmSignUpResponse,
  successDescription: "The account was confirmed.",
  summary: "Confirm Sign Up"
});

export const signIn = new Endpoint(auth, {
  bodySchema: SignInBody,
  description:
    "Starts a passwordless sign-in by emailing the user a one-time code. Responds the same way whether or not the account exists.",
  errors: {
    400: "The email was invalid.",
    429: "Too many sign-in attempts. Try again later."
  },
  id: "signIn",
  method: "POST",
  path: "/sign-in",
  successDescription: "A sign-in code was sent if the account exists.",
  successStatus: "202",
  summary: "Sign In"
});

export const verifySignIn = new Endpoint(auth, {
  bodySchema: VerifySignInBody,
  description: "Completes a passwordless sign-in with the emailed code and sets session cookies.",
  errors: {
    400: "The code was invalid or expired.",
    401: "There is no sign-in in progress, or it expired.",
    429: "Too many attempts. Try again later."
  },
  id: "verifySignIn",
  method: "POST",
  path: "/sign-in/verify",
  responseSchema: CurrentUser,
  successDescription: "The signed-in user.",
  summary: "Verify Sign In"
});

export const refreshSession = new Endpoint(auth, {
  description: "Exchanges the refresh token cookie for new session cookies.",
  errors: {
    401: "The refresh token is missing, expired, or revoked."
  },
  id: "refreshSession",
  method: "POST",
  path: "/refresh",
  successDescription: "The session cookies were renewed.",
  successStatus: "204",
  summary: "Refresh Session"
});

export const signOut = new Endpoint(auth, {
  description: "Revokes the refresh token and clears all session cookies.",
  id: "signOut",
  method: "POST",
  path: "/sign-out",
  successDescription: "The user was signed out.",
  successStatus: "204",
  summary: "Sign Out"
});

export const getCurrentUser = new Endpoint(auth, {
  access: "user",
  description: "Returns the user for the current session.",
  id: "getCurrentUser",
  method: "GET",
  path: "/me",
  responseSchema: CurrentUser,
  successDescription: "The signed-in user.",
  summary: "Get Current User"
});
