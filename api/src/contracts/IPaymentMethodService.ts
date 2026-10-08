import type {
  CreatePaymentMethodWithTokenBody,
  ListPaymentMethodsResponse,
  PaymentMethodDto,
  UpdatePaymentMethodBody
} from "@mm/lib";

export interface IPaymentMethodService {
  createPaymentMethod: (body: CreatePaymentMethodWithTokenBody) => Promise<PaymentMethodDto>;
  deletePaymentMethod: (id: string) => Promise<void>;
  getPaymentMethod: (id: string) => Promise<PaymentMethodDto>;
  listPaymentMethods: () => Promise<ListPaymentMethodsResponse>;
  updatePaymentMethod: (id: string, body: UpdatePaymentMethodBody) => Promise<PaymentMethodDto>;
}
