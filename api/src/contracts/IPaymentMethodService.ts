import type { CreatePaymentMethodBody, ListPaymentMethodsResponse, PaymentMethodDto, UpdatePaymentMethodBody } from "@mm/lib";

export interface IPaymentMethodService {
  createPaymentMethod: (body: CreatePaymentMethodBody) => Promise<PaymentMethodDto>;
  deletePaymentMethod: (id: string) => Promise<void>;
  listPaymentMethods: () => Promise<ListPaymentMethodsResponse>;
  updatePaymentMethod: (id: string, body: UpdatePaymentMethodBody) => Promise<PaymentMethodDto>;
}
