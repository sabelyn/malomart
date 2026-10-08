import type { infer as zinfer } from "zod";
import { instanceof as instanceOf, strictObject } from "zod";

import { PaymentMethod } from "../customers/types";

export const VaultCard = strictObject({
  ...PaymentMethod.pick({
    brand: true,
    customerId: true,
    expirationMonth: true,
    expirationYear: true,
    lastFour: true,
    token: true
  }).shape,
  cypher: instanceOf(Uint8Array)
});
export type VaultCard = zinfer<typeof VaultCard>;
