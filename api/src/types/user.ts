import type { CurrentUser, Customer } from "@mm/lib";

export type User = CurrentUser & {
  customerData: Omit<Customer, "id">;
};
