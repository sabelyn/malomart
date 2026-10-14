import type {
  AddressDto,
  CreateAddressBody,
  CustomerDto,
  ListAddressesResponse,
  UpdateAddressBody,
  UpdateCartBody,
  UpdateCartResponse
} from "@mm/lib";

export interface ICustomerService {
  createAddress: (body: CreateAddressBody) => Promise<AddressDto>;
  deleteAddress: (id: string) => Promise<void>;
  deleteCustomerRecord: () => Promise<void>;
  deleteSavedData: () => Promise<void>;
  getAddress: (id: string) => Promise<AddressDto>;
  getCustomer: () => Promise<CustomerDto>;
  getCustomerCart: () => Promise<Record<string, number>>;
  listAddresses: () => Promise<ListAddressesResponse>;
  updateAddress: (id: string, body: UpdateAddressBody) => Promise<AddressDto>;
  updateCart: (body: UpdateCartBody) => Promise<UpdateCartResponse>;
}
