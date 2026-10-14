import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PaginatedQueryOptions } from "@mm/clients";
import { getItemById, getPaginatedResults, InvalidCursorError } from "@mm/clients";
import type { CreateOrderBody, ListOrdersQuery, OrderItemEntry } from "@mm/lib";
import { getOrderTotal, Order, OrderOverview, OrderStatus } from "@mm/lib";
import { inject, injectable } from "tsyringe";
import { strictObject } from "zod";

import type { ICustomerService, IOrderService, IPaymentMethodService, IProductService } from "@/contracts";
import { CUSTOMER_SERVICE, DB, PAYMENT_METHOD_SERVICE, PRODUCT_SERVICE, USER } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, conflict, mapConditionFailure, notFound } from "@/errors/helpers";
import type { User } from "@/types/user";
import { parseStored } from "@/utils/parsing";

const SelectedOrder = strictObject({
  ...OrderOverview.omit({ total: true }).shape,
  items: Order.shape.items
});

const { orders } = env.TABLE_NAMES;
const { ordersByCustomer, ordersByStatus, ordersByCustomerStatus } = env.TABLE_INDEXES;

@injectable()
export class OrderService implements IOrderService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(CUSTOMER_SERVICE) private readonly customerService: ICustomerService,
    @inject(PAYMENT_METHOD_SERVICE) private readonly paymentMethodService: IPaymentMethodService,
    @inject(PRODUCT_SERVICE) private readonly productService: IProductService,
    @inject(USER) private readonly user: User
  ) { }

  cancelOrder = async (id: string) => {
    const ExpressionAttributeValues: Record<string, string> = { ":placed": OrderStatus.Placed, ":confirmed": OrderStatus.Confirmed, ":cancelled": OrderStatus.Cancelled };
    let ConditionExpression = "status = :placed OR status = :confirmed";
    if (!this.user.isAdmin) {
      ConditionExpression = `customerId = :customerId AND (${ConditionExpression})`;
      ExpressionAttributeValues[":customerId"] = this.user.id
    }

    try {
      await this.db.send(new UpdateCommand({
        TableName: orders,
        Key: { id },
        ConditionExpression,
        UpdateExpression: "SET status = :cancelled",
        ExpressionAttributeValues
      }));
    } catch (err) {
      throw mapConditionFailure(err, "Order");
    }
  }

  createOrder = async (body: CreateOrderBody) => {
    const customerId = this.user.id;
    const { addressId, paymentMethodId } = body;

    const [address, cart, paymentMethod] = await Promise.all([
      this.customerService.getAddress(addressId),
      this.customerService.getCustomerCart(),
      this.paymentMethodService.getPaymentMethodWithToken(paymentMethodId)
    ]);

    const productIds = Object.keys(cart);
    if (productIds.length === 0) {
      throw badRequest("The customer's cart has no items.");
    }

    const products = await this.productService.getProducts(productIds);
    const orderEntries: Record<string, OrderItemEntry> = {};
    for (const { id, stockCount, price, title } of products) {
      const inCart = cart[id];
      if (stockCount < inCart) {
        throw conflict(`Not enough ${title} in stock.`);
      }
      orderEntries[id] = { amount: inCart, pricePerUnit: price };
    }

    const { street, city, region, postalCode, recipient } = address;
    const { brand, lastFour, expirationMonth, expirationYear, token } = paymentMethod;
    const orderDate = new Date().toISOString();
    const order: Order = {
      id: crypto.randomUUID(),
      customerId,
      orderDate,
      status: OrderStatus.Placed,
      statusUpdates: {
        [OrderStatus.Placed]: orderDate
      },
      items: orderEntries,
      address: { recipient, street, city, region, postalCode },
      paymentMethod: { brand, lastFour, expirationMonth, expirationYear, token }
    };

    const result = await this.db.send(new PutCommand({
      TableName: orders,
      Item: order
    }));

    return this.toOrderDto(order);
  }

  getOrder = async (id: string) => {
    const order = await getItemById<Order>(this.db, orders, id);
    if (!order || !(order.customerId === this.user.id && !this.user.isAdmin)) {
      throw notFound("Order could not be found.");
    }

    return this.toOrderDto(order);
  }

  listOrders = async (query: ListOrdersQuery) => {
    const { cursor, limit, statuses } = query;
    const customerId = this.user.isAdmin ? query.customerId : this.user.id;
    const select = Object.keys(SelectedOrder.shape);

    const options: PaginatedQueryOptions = {
      tableName: orders,
      keys: ["id", "orderDate"],
      cursor,
      limit,
      select
    };
    if (customerId && statuses?.length) {
      options.indexName = ordersByCustomerStatus
      options.keyCondition = "customerId = :customerId AND status in :statuses";
      options.keys.push("customerId", "status");
    } else if (customerId) {
      options.indexName = ordersByCustomer;
      options.keyCondition = "customerId = :customerId";
      options.keys.push("customerId");
    } else if (statuses) {
      options.indexName = ordersByStatus;
      options.keyCondition = "status in :statuses";
      options.keys.push("status");
    }

    if (customerId || statuses?.length) {
      options.attributeValues = {
        ...(customerId ? { ":customerId": customerId } : {}),
        ...(statuses ? { ":statuses": statuses } : {})
      };
    }

    try {
      const results = await getPaginatedResults(this.db, options);
      return {
        data: results.items.map(this.toOrderOverview),
        pagination: {
          limit,
          hasNext: results.hasNext,
          cursor: results.cursor
        }
      };
    } catch (err) {
      if (err instanceof InvalidCursorError) {
        throw badRequest(err.message, { cause: err, details: { cursor } });
      }
      throw err;
    }
  }

  private toOrderDto = (data: unknown) => {
    const order = parseStored(data, Order);
    const { brand, lastFour } = order.paymentMethod;
    return {
      ...order,
      paymentMethod: { brand, lastFour }
    };
  }

  private toOrderOverview = (data: unknown) => {
    const { items, ...order } = parseStored(data, SelectedOrder);
    return {
      ...order,
      total: getOrderTotal(items)
    }
  }
}
