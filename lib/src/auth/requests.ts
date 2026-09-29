import type { infer as zinfer } from "zod";
import { strictObject } from "zod";

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
