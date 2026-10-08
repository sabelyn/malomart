import { apiRoot, Endpoint, Route } from "../api";
import { IdParams } from "../common";
import { ListOrdersResponse } from "../orders/responses";
import { CreateAddressBody, CreatePaymentMethodWithTokenBody, UpdateAddressBody, UpdatePaymentMethodBody } from "./requests";
import {
  AddressDto,
  CustomerDto,
  ListAddressesResponse,
  ListPaymentMethodsResponse,
  PaymentMethodDto
} from "./responses";

export const customers = new Route("/customers", "user", ["Customers"], apiRoot);

export const getCustomer = new Endpoint(customers, {
  description: "Get the customer data for the currentl logged in user.",
  id: "getCustomer",
  method: "GET",
  path: "/",
  schemas: {
    response: CustomerDto
  },
  successDescription: "Customer data, including order defaults.",
  summary: "Get Customer"
});

export const createAddress = new Endpoint(customers, {
  description: "Add a new address for the currently logged in customer.",
  errors: {
    400: "Request body was invalid."
  },
  id: "createAddress",
  method: "POST",
  path: "/addresses",
  schemas: {
    body: CreateAddressBody,
    response: AddressDto
  },
  successDescription: "The newly-created address.",
  successStatus: "201",
  summary: "Create an Address"
});

export const listAddresses = new Endpoint(customers, {
  description: "List all addresses for the logged-in customer.",
  id: "listAddresses",
  method: "GET",
  path: "/addresses",
  schemas: {
    response: ListAddressesResponse
  },
  successDescription: "All the customer's saved addresses.",
  summary: "List Addresses"
});

export const updateAddress = new Endpoint(customers, {
  description: "Update an existing address for the currently logged in customer.",
  errors: {
    400: "ID param or request body was invalid.",
    404: "The address could not be found."
  },
  id: "UpdateAddress",
  method: "PUT",
  path: "/addresses/{id}",
  schemas: {
    params: IdParams,
    body: UpdateAddressBody,
    response: AddressDto
  },
  successDescription: "The updated address.",
  successStatus: "200",
  summary: "Update an Address"
});

export const deleteAddress = new Endpoint(customers, {
  description: "Delete a saved address for the currently logged in customer.",
  errors: {
    400: "The ID parameter was invalid."
  },
  id: "deleteAddress",
  method: "DELETE",
  path: "/addresses/{id}",
  schemas: {
    params: IdParams
  },
  successDescription: "The address was successfully deleted.",
  successStatus: "204",
  summary: "Delete an Address"
});

export const createPaymentMethod = new Endpoint(customers, {
  description: "Add a new payment method for the currently logged in customer.",
  errors: {
    400: "Request body was invalid."
  },
  id: "createPaymentMethod",
  method: "POST",
  path: "/payment-methods",
  schemas: {
    body: CreatePaymentMethodWithTokenBody,
    response: PaymentMethodDto
  },
  successDescription: "The newly-created payment method.",
  successStatus: "201",
  summary: "Create a Payment Method"
});

export const listPaymentMethods = new Endpoint(customers, {
  description: "List all payment methods for the logged-in customer.",
  id: "listPaymentMethods",
  method: "GET",
  path: "/payment-methods",
  schemas: {
    response: ListPaymentMethodsResponse
  },
  successDescription: "All the customer's saved payment methods.",
  summary: "List Payment Methods"
});

export const updatePaymentMethod = new Endpoint(customers, {
  description: "Update an existing payment method for the currently logged in customer.",
  errors: {
    400: "ID param or request body was invalid.",
    404: "The payment method could not be found."
  },
  id: "UpdatePaymentMethod",
  method: "PUT",
  path: "/payment-methods/{id}",
  schemas: {
    params: IdParams,
    body: UpdatePaymentMethodBody,
    response: PaymentMethodDto
  },
  successDescription: "The updated payment method.",
  successStatus: "200",
  summary: "Update a Payment Method"
});

export const deletePaymentMethod = new Endpoint(customers, {
  description: "Delete a saved payment method for the currently logged in customer.",
  errors: {
    400: "The ID parameter was invalid."
  },
  id: "deletePaymentMethod",
  method: "DELETE",
  path: "/payment-methods/{id}",
  schemas: {
    params: IdParams
  },
  successDescription: "The payment method was successfully deleted.",
  successStatus: "204",
  summary: "Delete a Payment Method"
});

export const listCustomerOrders = new Endpoint(customers, {
  description: "List all the orders for the currently logged-in customer.",
  id: "listCustomerOrders",
  method: "GET",
  path: "/orders",
  schemas: {
    response: ListOrdersResponse
  },
  successDescription: "All past orders placed by this customer.",
  summary: "List Customer Orders"
});
