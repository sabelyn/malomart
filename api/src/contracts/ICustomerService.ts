import type { AddressDto, CreateAddressBody, CustomerDto, ListAddressesResponse, UpdateAddressBody } from "@mm/lib";

export interface ICustomerService {
  createAddress: (body: CreateAddressBody) => Promise<AddressDto>;
  deleteAddress: (id: string) => Promise<void>;
  getAddress: (id: string) => Promise<AddressDto>;
  getCustomer: () => Promise<CustomerDto>;
  listAddresses: () => Promise<ListAddressesResponse>;
  updateAddress: (id: string, body: UpdateAddressBody) => Promise<AddressDto>;
}
