import type { infer as zinfer } from "zod";
import { object, string, strictObject } from "zod";

import { DisplayName, Email, OtpCode } from "./types";

export const SignUpBody = strictObject({
  email: Email,
  name: DisplayName
}).meta({ id: "SignUpBody" });
export type SignUpBody = zinfer<typeof SignUpBody>;

export const ConfirmSignUpBody = strictObject({
  email: Email,
  code: OtpCode
}).meta({ id: "ConfirmSignUpBody" });
export type ConfirmSignUpBody = zinfer<typeof ConfirmSignUpBody>;

export const SignInBody = strictObject({
  email: Email
}).meta({ id: "SignInBody" });
export type SignInBody = zinfer<typeof SignInBody>;

export const VerifySignInBody = strictObject({
  code: OtpCode
}).meta({ id: "VerifySignInBody" });
export type VerifySignInBody = zinfer<typeof VerifySignInBody>;

export const UpdateProfileBody = strictObject({
  name: DisplayName
}).meta({ id: "UpdateProfileBody" });
export type UpdateProfileBody = zinfer<typeof UpdateProfileBody>;

export const RequestEmailChangeBody = strictObject({
  email: Email
}).meta({ id: "RequestEmailChangeBody" });
export type RequestEmailChangeBody = zinfer<typeof RequestEmailChangeBody>;

export const ConfirmEmailChangeBody = strictObject({
  code: OtpCode
}).meta({ id: "ConfirmEmailChangeBody" });
export type ConfirmEmailChangeBody = zinfer<typeof ConfirmEmailChangeBody>;

export const ConfirmAccountDeletionBody = strictObject({
  code: OtpCode
}).meta({ id: "ConfirmAccountDeletionBody" });
export type ConfirmAccountDeletionBody = zinfer<typeof ConfirmAccountDeletionBody>;

export const StartGoogleSignInQuery = object({
  returnTo: string().optional().meta({ description: "The app path to land on after signing in.", example: "/cart" })
}).meta({ id: "StartGoogleSignInQuery" });
export type StartGoogleSignInQuery = zinfer<typeof StartGoogleSignInQuery>;

export const CompleteGoogleSignInQuery = object({
  code: string().optional(),
  state: string().optional(),
  error: string().optional(),
  error_description: string().optional()
}).meta({ id: "CompleteGoogleSignInQuery" });
export type CompleteGoogleSignInQuery = zinfer<typeof CompleteGoogleSignInQuery>;
