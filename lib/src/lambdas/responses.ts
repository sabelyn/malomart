import { strictObject, string } from "zod";
import type { infer as zinfer } from "zod"

export const CreatePaymentMethodResponse = strictObject({
  token: string().nonempty()
});
export type CreatePaymentMethodResponse = zinfer<typeof CreatePaymentMethodResponse>;
