import type { CreateOrderBody, ListOrdersQuery, ListOrdersResponse, OrderDto } from "@mm/lib";

export interface IOrderService {
  cancelOrder: (id: string) => Promise<void>;
  createOrder: (body: CreateOrderBody) => Promise<OrderDto>;
  getOrder: (id: string) => Promise<OrderDto>;
  listOrders: (query: ListOrdersQuery) => Promise<ListOrdersResponse>;
}
