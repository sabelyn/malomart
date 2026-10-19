import { apiRoot, Endpoint, Route } from "../api";
import {
  CompleteGoogleSignInQuery,
  ConfirmAccountDeletionBody,
  ConfirmEmailChangeBody,
  ConfirmSignUpBody,
  RequestEmailChangeBody,
  SignInBody,
  SignUpBody,
  StartGoogleSignInQuery,
  UpdateProfileBody,
  VerifySignInBody
} from "./requests";
import { ConfirmSignUpResponse, CurrentUser } from "./responses";

export const auth = new Route("/auth", "public", ["Auth"], apiRoot);

export const signUp = new Endpoint(auth, {
  description: "Registers a new account without a password and emails the user a confirmation code.",
  errors: {
    400: "The email or name was invalid.",
    409: "An account already exists for this email.",
    429: "Too many sign-up attempts. Try again later."
  },
  id: "signUp",
  method: "POST",
  path: "/sign-up",
  schemas: { body: SignUpBody },
  successDescription: "The account was created and a confirmation code was sent.",
  successStatus: "202",
  summary: "Sign Up"
});

export const confirmSignUp = new Endpoint(auth, {
  description:
    "Confirms a new account with the emailed code. When the sign-up session is still valid, the user is signed in and session cookies are set.",
  errors: {
    400: "The code was invalid or expired.",
    429: "Too many attempts. Try again later."
  },
  id: "confirmSignUp",
  method: "POST",
  path: "/sign-up/confirm",
  schemas: { body: ConfirmSignUpBody, response: ConfirmSignUpResponse },
  successDescription: "The account was confirmed.",
  summary: "Confirm Sign Up"
});

export const signIn = new Endpoint(auth, {
  description:
    "Starts a passwordless sign-in by emailing the user a one-time code. Responds the same way whether or not the account exists.",
  errors: {
    400: "The email was invalid.",
    429: "Too many sign-in attempts. Try again later."
  },
  id: "signIn",
  method: "POST",
  path: "/sign-in",
  schemas: { body: SignInBody },
  successDescription: "A sign-in code was sent if the account exists.",
  successStatus: "202",
  summary: "Sign In"
});

export const verifySignIn = new Endpoint(auth, {
  description: "Completes a passwordless sign-in with the emailed code and sets session cookies.",
  errors: {
    400: "The code was invalid or expired.",
    401: "There is no sign-in in progress, or it expired.",
    429: "Too many attempts. Try again later."
  },
  id: "verifySignIn",
  method: "POST",
  path: "/sign-in/verify",
  schemas: { body: VerifySignInBody, response: CurrentUser },
  successDescription: "The signed-in user.",
  summary: "Verify Sign In"
});

export const startGoogleSignIn = new Endpoint(auth, {
  description:
    "Starts a Google sign-in by redirecting through Cognito to Google. Navigate the browser here instead of fetching it.",
  id: "startGoogleSignIn",
  method: "GET",
  path: "/google",
  schemas: { query: StartGoogleSignInQuery },
  successDescription: "A redirect to Google's sign-in page.",
  successStatus: "302",
  summary: "Start Google Sign-In"
});

export const completeGoogleSignIn = new Endpoint(auth, {
  description:
    "The OAuth callback Cognito redirects to after Google sign-in. Exchanges the authorization code for session cookies.",
  id: "completeGoogleSignIn",
  method: "GET",
  path: "/google/callback",
  schemas: { query: CompleteGoogleSignInQuery },
  successDescription:
    "A redirect to the return path with session cookies set, or to the sign-in page with a googleError query param.",
  successStatus: "302",
  summary: "Complete Google Sign-In"
});

export const refreshSession = new Endpoint(auth, {
  description: "Exchanges the refresh token cookie for new session cookies.",
  errors: {
    401: "The refresh token is missing, expired, or revoked."
  },
  id: "refreshSession",
  method: "POST",
  path: "/refresh",
  schemas: {},
  successDescription: "The session cookies were renewed.",
  successStatus: "204",
  summary: "Refresh Session"
});

export const signOut = new Endpoint(auth, {
  description: "Revokes the refresh token and clears all session cookies.",
  id: "signOut",
  method: "POST",
  path: "/sign-out",
  schemas: {},
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
  schemas: { response: CurrentUser },
  successDescription: "The signed-in user.",
  summary: "Get Current User"
});

export const signOutEverywhere = new Endpoint(auth, {
  access: "user",
  description:
    "Revokes every refresh token the user has and clears the session cookies. Other devices stay signed in until their current access token expires.",
  id: "signOutEverywhere",
  method: "POST",
  path: "/me/sign-out",
  schemas: {},
  successDescription: "The user was signed out on every device.",
  successStatus: "204",
  summary: "Sign Out Everywhere"
});

export const updateProfile = new Endpoint(auth, {
  access: "user",
  description: "Updates the signed-in user's profile and renews the session so it reflects the change.",
  errors: {
    400: "The name was invalid."
  },
  id: "updateProfile",
  method: "PUT",
  path: "/me",
  schemas: { body: UpdateProfileBody, response: CurrentUser },
  successDescription: "The updated user.",
  summary: "Update Profile"
});

export const requestEmailChange = new Endpoint(auth, {
  access: "user",
  description:
    "Emails a confirmation code to a new address. The current email keeps working until the new one is confirmed.",
  errors: {
    400: "The email was invalid or is already the user's email.",
    403: "The user signs in with Google and can't change their email here.",
    409: "Another account already uses this email.",
    429: "Too many attempts. Try again later."
  },
  id: "requestEmailChange",
  method: "POST",
  path: "/me/email",
  schemas: { body: RequestEmailChangeBody },
  successDescription: "A confirmation code was sent to the new email.",
  successStatus: "202",
  summary: "Request Email Change"
});

export const confirmEmailChange = new Endpoint(auth, {
  access: "user",
  description: "Confirms the new email with the emailed code and renews the session so it reflects the change.",
  errors: {
    400: "The code was invalid or expired.",
    403: "The user signs in with Google and can't change their email here.",
    409: "Another account already uses this email.",
    429: "Too many attempts. Try again later."
  },
  id: "confirmEmailChange",
  method: "POST",
  path: "/me/email/confirm",
  schemas: { body: ConfirmEmailChangeBody, response: CurrentUser },
  successDescription: "The updated user.",
  summary: "Confirm Email Change"
});

export const requestAccountDeletion = new Endpoint(auth, {
  access: "user",
  description: "Emails the user a one-time code to confirm deleting their account.",
  errors: {
    429: "Too many attempts. Try again later."
  },
  id: "requestAccountDeletion",
  method: "POST",
  path: "/me/deletion",
  schemas: {},
  successDescription: "A confirmation code was sent.",
  successStatus: "202",
  summary: "Request Account Deletion"
});

export const confirmAccountDeletion = new Endpoint(auth, {
  access: "user",
  description:
    "Permanently deletes the account and its saved addresses and payment methods once the emailed code is confirmed. Clears the session cookies.",
  errors: {
    400: "The code was invalid or expired.",
    401: "There is no deletion in progress, or it expired.",
    429: "Too many attempts. Try again later."
  },
  id: "confirmAccountDeletion",
  method: "POST",
  path: "/me/deletion/confirm",
  schemas: { body: ConfirmAccountDeletionBody },
  successDescription: "The account was deleted.",
  successStatus: "204",
  summary: "Confirm Account Deletion"
});
