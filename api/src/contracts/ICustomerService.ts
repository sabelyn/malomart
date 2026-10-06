import type { AddressDto, CreateAddressBody, CustomerDto, ListAddressesResponse, ListOrdersResponse, UpdateAddressBody } from "@mm/lib";

export interface ICustomerService {
  createAddress: (body: CreateAddressBody) => Promise<AddressDto>;
  deleteAddress: (id: string) => Promise<void>;
  getCustomer: () => Promise<CustomerDto>;
  listAddresses: () => Promise<ListAddressesResponse>;
  listOrders: () => Promise<ListOrdersResponse>;
  updateAddress: (id: string, body: UpdateAddressBody) => Promise<AddressDto>;
}
