import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getItemById } from "@mm/clients";
import type { CreateAddressBody, UpdateAddressBody } from "@mm/lib";
import { Address } from "@mm/lib";
import { inject, injectable } from "tsyringe";

import type { ICustomerService, IPaymentMethodService } from "@/contracts";
import { DB, PAYMENT_METHOD_SERVICE, USER } from "@/contracts/tokens";
import env from "@/env";
import { ApiError } from "@/errors/ApiError";
import { mapConditionFailure, notFound } from "@/errors/helpers";
import type { User } from "@/types/user";
import { parseStored } from "@/utils/parsing";

const { addresses, customers } = env.TABLE_NAMES;
const { addressesByCustomer } = env.TABLE_INDEXES;

@injectable()
export class CustomerService implements ICustomerService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(PAYMENT_METHOD_SERVICE) private readonly paymentMethodService: IPaymentMethodService,
    @inject(USER) private readonly user: User
  ) { }

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
    try {
      await this.db.send(
        new DeleteCommand({
          TableName: addresses,
          Key: { id },
          ConditionExpression: "customerId = :customerId",
          ExpressionAttributeValues: { ":customerId": this.user.id }
        })
      );

      if (this.user.customerData.defaultAddressId === id) {
        await this.setDefaultAddress(null);
      }
    } catch (err) {
      throw mapConditionFailure(err, "Address");
    }
  };

  getAddress = async (id: string) => {
    const item = await getItemById<{ customerId?: unknown }>(this.db, addresses, id);
    if (item?.customerId !== this.user.id) {
      throw notFound("Address could not be found.");
    }
    return this.toAddressDto(item);
  }

  getCustomer = async () => {
    const { defaultAddressId, defaultPaymentMethodId } = this.user.customerData;
    const valueOrNull = <T>(result: PromiseSettledResult<Awaited<T>>): T | null => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      if (result.reason instanceof ApiError && result.reason.statusCode === 404) {
        return null;
      }
      throw result.reason;
    }

    const [address, paymentMethod] = await Promise.allSettled([
      defaultAddressId ? this.getAddress(defaultAddressId) : null,
      defaultPaymentMethodId ? this.paymentMethodService.getPaymentMethod(defaultPaymentMethodId) : null
    ]);

    return {
      id: this.user.id,
      defaultAddress: valueOrNull(address),
      defaultPaymentMethod: valueOrNull(paymentMethod)
    }
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
    const { setAsDefault, ...fields } = body;
    const customerId = this.user.id;

    const expParts: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, string> = { ":customerId": customerId };
    for (const [key, value] of Object.entries(fields)) {
      if (value) {
        expParts.push(`#${key} = :${key}`);
        names[`#${key}`] = key;
        values[`:${key}`] = value;
      }
    }

    let address: unknown;
    if (expParts.length > 0) {
      try {
        const result = await this.db.send(
          new UpdateCommand({
            TableName: addresses,
            Key: { id },
            ConditionExpression: "customerId = :customerId",
            UpdateExpression: `SET ${expParts.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW"
          })
        );
        address = result.Attributes;
      } catch (err) {
        throw mapConditionFailure(err, "Address");
      }
    }

    const dto = address ? this.toAddressDto(address) : await this.getAddress(id);
    if (setAsDefault && this.user.customerData.defaultAddressId !== id) {
      await this.setDefaultAddress(id);
    }

    return dto;
  };

  private setDefaultAddress = async (id: string | null) => {
    await this.db.send(
      new UpdateCommand({
        TableName: customers,
        Key: { id: this.user.id },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "SET defaultAddressId = :addressId",
        ExpressionAttributeValues: { ":addressId": id }
      })
    );
    this.user.customerData.defaultAddressId = id;
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
