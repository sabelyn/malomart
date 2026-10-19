import { email, string, enum as zenum } from "zod";

export const Email = email({ error: "Enter a valid email address." })
  .max(254, { error: "Email addresses can't be longer than 254 characters." })
  .meta({ id: "Email", example: "link@hyrule.com" });

export const DisplayName = string()
  .trim()
  .min(1, { error: "Enter your name." })
  .max(100, { error: "Names can't be longer than 100 characters." })
  .meta({ description: "The user's display name.", example: "Link" });

export const OtpCode = string()
  .trim()
  .regex(/^\d{6,8}$/, { error: "Enter the 6 to 8 digit code from your email." })
  .meta({ id: "OtpCode", description: "A one-time code sent to the user's email.", example: "12345678" });

export const SignInMethods = ["email", "google"] as const;
export const SignInMethod = zenum(SignInMethods).meta({
  id: "SignInMethod",
  description: "How the user signs in. Google users can't change their email here."
});
export type SignInMethod = (typeof SignInMethods)[number];

export const SIGN_IN_PAGE_PATH = "/auth/sign-in";

export const GOOGLE_ERROR_PARAM = "googleError";
export const GoogleSignInErrors = ["cancelled", "failed"] as const;
export const GoogleSignInError = zenum(GoogleSignInErrors).meta({
  id: "GoogleSignInError",
  description: "Why a Google sign-in sent the user back to the sign-in page."
});
export type GoogleSignInError = (typeof GoogleSignInErrors)[number];
