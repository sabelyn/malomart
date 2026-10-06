import { apiRoot, Endpoint, Route } from "../api";
import { IdParams } from "../common";
import { CreateOrderBody, ListOrdersQuery } from "./requests";
import { ListOrdersResponse, OrderDto } from "./responses";

export const orders = new Route("/orders", "user", ["Orders"], apiRoot);

export const listOrders = new Endpoint(orders, {
  access: "admin",
  description: "List paginated orders with optional filtering.",
  errors: {
    400: "The query parameters were invalid."
  },
  id: "listOrders",
  method: "GET",
  path: "/",
  schemas: {
    query: ListOrdersQuery,
    response: ListOrdersResponse
  },
  successDescription: "A paginated list of order overviews.",
  summary: "List Orders"
});

export const getOrder = new Endpoint(orders, {
  description: "Get a single order by its ID.",
  errors: {
    400: "ID param is not a valid UUID.",
    404: "The order could not be found, or the user doesn't have permission to view this order."
  },
  id: "getOrder",
  method: "GET",
  path: "/{id}",
  schemas: {
    params: IdParams,
    response: OrderDto
  },
  successDescription: "The full order including additional information like the address.",
  summary: "Get an Order"
});

export const createOrder = new Endpoint(orders, {
  description: "Submit a new purchase order for processing.",
  errors: {
    400: "The request body is invalid.",
    404: "A related entity cannot be found, such as the customer, address, payment method, or any of the submitted items.",
    409: "The amount of a purchased item exceeds the number in stock."
  },
  id: "createOrder",
  method: "POST",
  path: "/",
  schemas: {
    body: CreateOrderBody,
    response: OrderDto
  },
  successDescription: "The order was placed successfully and is being processed.",
  successStatus: "201",
  summary: "Create an Order"
});

export const cancelOrder = new Endpoint(orders, {
  description: "Cancel an in-progress order before it has shipped.",
  errors: {
    400: "The order ID was invalid.",
    404: "The order could not be found, or the user does not have permission to make this update.",
    409: "The order is in a status that does not allow cancellation."
  },
  id: "cancelOrder",
  method: "PUT",
  path: "/{id}/cancel",
  schemas: {
    params: IdParams
  },
  successDescription: "The order was successfully cancelled.",
  successStatus: "204",
  summary: "Cancel an Order"
});
