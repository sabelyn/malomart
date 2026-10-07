import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getItemById } from "@mm/clients";
import type { CreateAddressBody, CustomerDto, UpdateAddressBody } from "@mm/lib";
import { Address } from "@mm/lib";
import { inject } from "tsyringe";

import type { ICustomerService } from "@/contracts";
import { DB, USER } from "@/contracts/tokens";
import env from "@/env";
import { notFound } from "@/errors/helpers";
import type { User } from "@/types/user";
import { parseStored } from "@/utils/parsing";

const { addresses, customers } = env.TABLE_NAMES;
const { addressesByCustomer } = env.TABLE_INDEXES;

export class CustomerService implements ICustomerService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(USER) private readonly user: User
  ) {}

  createAddress = async (body: CreateAddressBody) => {
    const customerId = this.user.id;
    const { setAsDefault, ...data } = body;
    const Item: Address = {
      id: crypto.randomUUID(),
      customerId,
      ...data
    };

    await this.db.send(
      new PutCommand({
        TableName: env.TABLE_NAMES.addresses,
        Item
      })
    );
    if (setAsDefault) {
      await this.setDefaultAddress(Item.id);
    }

    return this.toAddressDto(Item);
  };

  deleteAddress = async (id: string) => {
    await this.db.send(
      new DeleteCommand({
        TableName: addresses,
        Key: { id },
        ConditionExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": this.user.id }
      })
    );
  };

  getAddress = async (id: string) => {
    const item = await getItemById(this.db, addresses, id, {
      ConditionExpression: "customerId = :customerId",
      ExpressionAttributeValues: { ":customerId": this.user.id }
    });
    if (item) {
      return this.toAddressDto(item);
    } else {
      throw notFound("Address could not be found.");
    }
  };

  getCustomer = async () => {
    const customer: CustomerDto = { id: this.user.id, defaultAddress: null, defaultPaymentMethod: null };
    const { defaultAddressId } = this.user.customerData;
    if (defaultAddressId) {
      customer.defaultAddress = await this.getAddress(defaultAddressId);
    }

    return customer;
  };

  listAddresses = async () => {
    const result = await this.db.send(
      new QueryCommand({
        TableName: addresses,
        IndexName: addressesByCustomer,
        KeyConditionExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": this.user.id }
      })
    );

    return result.Items ? result.Items.map(this.toAddressDto) : [];
  };

  updateAddress = async (id: string, body: UpdateAddressBody) => {
    const { setAsDefault, street, city, region, postalCode } = body;
    const customerId = this.user.id;

    const expParts: string[] = [];
    const values: Record<string, string> = { ":customerId": customerId };
    if (street) {
      expParts.push("street = :str");
      values[":str"] = street;
    }
    if (city) {
      expParts.push("city = :city");
      values[":city"] = city;
    }
    if (region) {
      expParts.push("region = :reg");
      values[":reg"] = region;
    }
    if (postalCode) {
      expParts.push("postalCode - :pc");
      values[":pc"] = postalCode;
    }

    let address: unknown;
    if (expParts.length > 0) {
      const result = await this.db.send(
        new UpdateCommand({
          TableName: addresses,
          Key: { id },
          ConditionExpression: "attribute_exists(id) AND customerId = :customerId",
          UpdateExpression: `SET ${expParts.join(", ")}`,
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW"
        })
      );
      address = result.Attributes;
    } else {
      address = await this.getAddress(id);
    }

    if (setAsDefault && this.user.customerData.defaultAddressId !== id) {
      await this.setDefaultAddress(id);
    }

    return this.toAddressDto(address);
  };

  private setDefaultAddress = async (id: string) => {
    await this.db.send(
      new UpdateCommand({
        TableName: customers,
        Key: { id: this.user.id },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "SET defaultAddressId = :addressId",
        ExpressionAttributeValues: { ":addressId": id }
      })
    );
  };

  private toAddressDto = (data: unknown) => {
    const { street, city, region, postalCode, id } = parseStored(data, Address);
    return {
      id,
      street,
      city,
      region,
      postalCode,
      isDefault: this.user.customerData.defaultAddressId === id
    };
  };
}
