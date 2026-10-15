import type { PaymentMethod } from "./types";

type Expiration = Pick<PaymentMethod, "expirationMonth" | "expirationYear">;

export const isCardExpired = ({ expirationMonth, expirationYear }: Expiration, now = new Date()) =>
  expirationYear < now.getFullYear() || (expirationYear === now.getFullYear() && expirationMonth < now.getMonth());
