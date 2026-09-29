import { email, string } from "zod";

export const Email = email().max(254).meta({ id: "Email", example: "link@hyrule.com" });

export const DisplayName = string().trim().min(1).max(100).meta({ description: "The user's display name.", example: "Link" });

export const OtpCode = string()
  .regex(/^\d{6,8}$/)
  .meta({ id: "OtpCode", description: "A one-time code sent to the user's email.", example: "12345678" });
