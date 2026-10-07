import type { infer as zinfer } from "zod";
import { boolean, strictObject, string } from "zod";

import { DisplayName, Email } from "./types";

export const CurrentUser = strictObject({
  id: string().meta({ description: "The user's Cognito subject ID." }),
  email: Email,
  name: DisplayName,
  isAdmin: boolean()
}).meta({ id: "CurrentUser", description: "The signed-in user." });
export type CurrentUser = zinfer<typeof CurrentUser>;

export const ConfirmSignUpResponse = strictObject({
  user: CurrentUser.nullable().meta({
    description:
      "The signed-in user, or null when the account was confirmed but the sign-up session expired and the user must sign in."
  })
}).meta({ id: "ConfirmSignUpResponse" });
export type ConfirmSignUpResponse = zinfer<typeof ConfirmSignUpResponse>;
