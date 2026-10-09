import type { LambdaClient } from "@aws-sdk/client-lambda";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getItemById, invoke, invokeAsync } from "@mm/clients";
import type { CreatePaymentMethodWithTokenBody, PaymentMethodIdEvent, UpdatePaymentMethodBody } from "@mm/lib";
import { PaymentMethod, PaymentMethodMetadata } from "@mm/lib";
import { inject, injectable } from "tsyringe";

import type { IPaymentMethodService } from "@/contracts";
import { DB, LAMBDA, USER } from "@/contracts/tokens";
import env from "@/env";
import { conflict, internal, mapConditionFailure, notFound } from "@/errors/helpers";
import type { User } from "@/types/user";
import { parseStored } from "@/utils/parsing";

const { describeCard, deleteCard, updateCard } = env.INVOKE_FUNCTION_NAMES;
const { customers, paymentMethods } = env.TABLE_NAMES;
const { paymentMethodsByCustomer } = env.TABLE_INDEXES;

@injectable()
export class PaymentMethodService implements IPaymentMethodService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(LAMBDA) private readonly lambda: LambdaClient,
    @inject(USER) private readonly user: User
  ) { }

  createPaymentMethod = async (body: CreatePaymentMethodWithTokenBody) => {
    const { token, setAsDefault } = body;
    const customerId = this.user.id;

    const existingMethods = await this.db.send(
      new QueryCommand({
        TableName: paymentMethods,
        IndexName: paymentMethodsByCustomer,
        KeyConditionExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": customerId }
      })
    );
    if (existingMethods.Items?.some(m => m.token === token)) {
      throw conflict("Token already in use.");
    }

    const input: PaymentMethodIdEvent = { customerId, token };
    const metadata = await invoke(this.lambda, describeCard, input, PaymentMethodMetadata.nullable());
    if (!metadata) {
      throw notFound("A card with that token could not be found.");
    } else if ("errorName" in metadata) {
      throw internal({ errorName: metadata.errorName });
    }

    const Item: PaymentMethod = {
      id: crypto.randomUUID(),
      ...metadata,
      token,
      customerId
    };
    await this.db.send(
      new PutCommand({
        TableName: paymentMethods,
        Item
      })
    );
    if (setAsDefault) {
      await this.setDefaultPaymentMethod(Item.id);
    }

    return this.toPaymentMethodDto(Item);
  };

  deletePaymentMethod = async (id: string) => {
    const customerId = this.user.id;
    try {
      const result = await this.db.send(
        new DeleteCommand({
          TableName: paymentMethods,
          Key: { id },
          ConditionExpression: "customerId = :customerId",
          ExpressionAttributeValues: { ":customerId": customerId },
          ReturnValues: "ALL_OLD"
        })
      );

      const { token } = result.Attributes ?? {};
      if (token) {
        const input = { token, customerId };
        await invokeAsync(this.lambda, deleteCard, input);
      }

      if (this.user.customerData.defaultPaymentMethodId == id) {
        await this.setDefaultPaymentMethod(null);
      }
    } catch (err) {
      throw mapConditionFailure(err, "Payment method");
    }
  };

  getPaymentMethod = async (id: string) => {
    const card = await getItemById<PaymentMethod>(this.db, paymentMethods, id);
    if (card && card.customerId === this.user.id) {
      return this.toPaymentMethodDto(card);
    }
    throw notFound("Payment method not found.");
  };

  listPaymentMethods = async () => {
    const customerId = this.user.id;
    const result = await this.db.send(
      new QueryCommand({
        TableName: paymentMethods,
        IndexName: paymentMethodsByCustomer,
        KeyConditionExpression: "customerId = :customerId",
        ExpressionAttributeValues: { ":customerId": customerId }
      })
    );

    return result.Items?.map(this.toPaymentMethodDto) ?? [];
  };

  updatePaymentMethod = async (id: string, body: UpdatePaymentMethodBody) => {
    const customerId = this.user.id;
    const { expiration, setAsDefault } = body;
    let updated: unknown = null;
    if (expiration) {
      const { expirationMonth, expirationYear } = expiration;
      try {
        const result = await this.db.send(
          new UpdateCommand({
            TableName: paymentMethods,
            Key: { id },
            ConditionExpression: "customerId = :customerId",
            UpdateExpression: "SET expirationMonth = :month, expirationYear = :year",
            ExpressionAttributeValues: {
              ":customerId": customerId,
              ":month": expirationMonth,
              ":year": expirationYear
            },
            ReturnValues: "ALL_NEW"
          })
        );

        updated = result.Attributes;
        const { token } = result.Attributes ?? {};
        if (token) {
          const input = { token, customerId, expirationMonth, expirationYear };
          await invokeAsync(this.lambda, updateCard, input);
        }
      } catch (err) {
        throw mapConditionFailure(err, "Payment method");
      }
    }

    const dto = updated ? this.toPaymentMethodDto(updated) : await this.getPaymentMethod(id);
    if (setAsDefault && this.user.customerData.defaultPaymentMethodId !== id) {
      await this.setDefaultPaymentMethod(id);
      dto.isDefault = true;
    }

    return dto;
  };

  private setDefaultPaymentMethod = async (id: string | null) => {
    await this.db.send(
      new UpdateCommand({
        TableName: customers,
        Key: { id: this.user.id },
        ConditionExpression: "attribute_exists(id)",
        UpdateExpression: "SET defaultPaymentMethodId = :id",
        ExpressionAttributeValues: { ":id": id }
      })
    );
    this.user.customerData.defaultPaymentMethodId = id;
  };

  private toPaymentMethodDto = (data: unknown) => {
    const { brand, expirationMonth, expirationYear, id, lastFour } = parseStored(data, PaymentMethod);
    return {
      brand,
      expirationMonth,
      expirationYear,
      id,
      lastFour,
      isDefault: this.user.customerData.defaultPaymentMethodId === id
    };
  };
}
