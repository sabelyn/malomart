import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PaginatedQueryOptions } from "@mm/clients";
import { getItemById, getPaginatedResults, InvalidCursorError } from "@mm/clients";
import type { CreateOrderBody, ListOrdersQuery, OrderItemEntry } from "@mm/lib";
import { getOrderItemCount, getOrderTotal, isCardExpired, Order, OrderOverview, OrderStatus, ShippingOptions } from "@mm/lib";
import { inject, injectable } from "tsyringe";
import { strictObject } from "zod";

import type { ICustomerService, IOrderService, IPaymentMethodService, IProductService } from "@/contracts";
import { CUSTOMER_SERVICE, DB, PAYMENT_METHOD_SERVICE, PRODUCT_SERVICE, USER } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, conflict, mapConditionFailure, notFound } from "@/errors/helpers";
import type { User } from "@/types/user";
import { parseStored } from "@/utils/parsing";

const SelectedOrder = strictObject({
  ...OrderOverview.omit({ total: true, itemCount: true }).shape,
  products: Order.shape.products,
  shipping: Order.shape.shipping
});

const sameItems = (a: Record<string, number>, b: Record<string, number>) => {
  const ids = Object.keys(a);
  return ids.length === Object.keys(b).length && ids.every(id => a[id] === b[id]);
};

const { carts, orders, products: productsTable } = env.TABLE_NAMES;
const { ordersByCustomer, ordersByStatus, ordersByCustomerStatus } = env.TABLE_INDEXES;

@injectable()
export class OrderService implements IOrderService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(CUSTOMER_SERVICE) private readonly customerService: ICustomerService,
    @inject(PAYMENT_METHOD_SERVICE) private readonly paymentMethodService: IPaymentMethodService,
    @inject(PRODUCT_SERVICE) private readonly productService: IProductService,
    @inject(USER) private readonly user: User
  ) {}

  cancelOrder = async (id: string) => {
    const ExpressionAttributeValues: Record<string, string> = {
      ":placed": OrderStatus.Placed,
      ":confirmed": OrderStatus.Confirmed,
      ":cancelled": OrderStatus.Cancelled,
      ":now": new Date().toISOString()
    };
    let ConditionExpression = "currentStatus = :placed OR currentStatus = :confirmed";
    if (!this.user.isAdmin) {
      ConditionExpression = `customerId = :customerId AND (${ConditionExpression})`;
      ExpressionAttributeValues[":customerId"] = this.user.id;
    }

    try {
      await this.db.send(
        new UpdateCommand({
          TableName: orders,
          Key: { id },
          ConditionExpression,
          UpdateExpression: "SET currentStatus = :cancelled, statusUpdates.#cancelled = :now",
          ExpressionAttributeNames: { "#cancelled": OrderStatus.Cancelled },
          ExpressionAttributeValues,
          ReturnValuesOnConditionCheckFailure: "ALL_OLD"
        })
      );
    } catch (err) {
      const cancellable: string[] = [OrderStatus.Placed, OrderStatus.Confirmed];
      const isUncancellableOrder =
        err instanceof ConditionalCheckFailedException &&
        err.Item &&
        (this.user.isAdmin || err.Item.customerId?.S === this.user.id) &&
        !cancellable.includes(err.Item.currentStatus?.S ?? "");
      if (isUncancellableOrder) {
        throw conflict("Order can no longer be cancelled.");
      }
      throw mapConditionFailure(err, "Order");
    }
  };

  createOrder = async (body: CreateOrderBody) => {
    const customerId = this.user.id;
    const { id, addressId, paymentMethodId, shippingMethod, items, expectedTotal } = body;

    const existing = await this.findPlacedOrder(id);
    if (existing) {
      return existing;
    }

    const [address, cart, paymentMethod] = await Promise.all([
      this.customerService.getAddress(addressId),
      this.customerService.getCustomerCart(),
      this.paymentMethodService.getPaymentMethodWithToken(paymentMethodId)
    ]);

    if (isCardExpired(paymentMethod)) {
      throw badRequest("The payment method has expired.");
    }
    const productIds = Object.keys(cart);
    if (productIds.length === 0) {
      throw badRequest("The customer's cart has no items.");
    }
    if (!sameItems(cart, items)) {
      throw conflict("The cart changed since it was reviewed.");
    }

    const products = await this.productService.getProducts(productIds);
    if (products.length < productIds.length) {
      throw notFound("Some items in the cart could not be found.");
    }
    const orderEntries: Record<string, OrderItemEntry> = {};
    for (const { id: productId, stockCount, price, title } of products) {
      const inCart = cart[productId];
      if (stockCount < inCart) {
        throw conflict(`Not enough ${title} in stock.`);
      }
      orderEntries[productId] = { amount: inCart, pricePerUnit: price };
    }

    const { street, city, region, postalCode, recipient } = address;
    const { brand, lastFour, expirationMonth, expirationYear, token } = paymentMethod;
    const orderDate = new Date().toISOString();
    const order: Order = {
      id,
      customerId,
      orderDate,
      currentStatus: OrderStatus.Placed,
      statusUpdates: {
        [OrderStatus.Placed]: orderDate
      },
      products: orderEntries,
      shipping: { method: shippingMethod, cost: ShippingOptions[shippingMethod].cost },
      address: { recipient, street, city, region, postalCode },
      paymentMethod: { brand, lastFour, expirationMonth, expirationYear, token }
    };
    if (getOrderTotal(order) !== expectedTotal) {
      throw conflict("Prices changed since the order was reviewed.");
    }

    try {
      await this.db.send(
        new TransactWriteCommand({
          TransactItems: [
            ...products.map(({ id: productId }) => ({
              Update: {
                TableName: productsTable,
                Key: { id: productId },
                ConditionExpression: "stockCount >= :amount",
                UpdateExpression: "SET stockCount = stockCount - :amount",
                ExpressionAttributeValues: { ":amount": orderEntries[productId].amount },
                ReturnValuesOnConditionCheckFailure: "ALL_OLD" as const
              }
            })),
            {
              Put: {
                TableName: orders,
                Item: order,
                ConditionExpression: "attribute_not_exists(id)"
              }
            },
            {
              Update: {
                TableName: carts,
                Key: { customerId },
                ConditionExpression: "#items = :cart",
                UpdateExpression: "SET #items = :empty",
                ExpressionAttributeNames: { "#items": "items" },
                ExpressionAttributeValues: { ":cart": cart, ":empty": {} }
              }
            }
          ]
        })
      );
    } catch (err) {
      if (err instanceof TransactionCanceledException) {
        const failed = (index: number) => err.CancellationReasons?.[index]?.Code === "ConditionalCheckFailed";
        if (failed(products.length)) {
          const placed = await this.findPlacedOrder(id);
          if (placed) {
            return placed;
          }
        }
        const failedIndex = products.findIndex((_, index) => failed(index));
        const product = products[failedIndex];
        if (product) {
          throw err.CancellationReasons?.[failedIndex].Item
            ? conflict(`Not enough ${product.title} in stock.`, err)
            : notFound(`${product.title} is no longer available.`);
        }
        if (failed(products.length + 1)) {
          throw conflict("The cart changed since it was reviewed.", err);
        }
      }
      throw err;
    }

    return this.toOrderDto(order);
  };

  getOrder = async (id: string) => {
    const order = await getItemById<Order>(this.db, orders, id);
    if (!order || (order.customerId !== this.user.id && !this.user.isAdmin)) {
      throw notFound("Order could not be found.");
    }

    return this.toOrderDto(order);
  };

  listOrders = async (query: ListOrdersQuery) => {
    const { cursor, limit, status } = query;
    const customerId = this.user.isAdmin ? query.customerId : this.user.id;
    const select = Object.keys(SelectedOrder.shape);

    const options: PaginatedQueryOptions = {
      tableName: orders,
      keys: ["id"],
      cursor,
      limit,
      select,
      reverse: true
    };
    if (customerId && status) {
      options.indexName = ordersByCustomerStatus;
      options.keyCondition = "customerId = :customerId AND currentStatus = :status";
      options.keys.push("customerId", "currentStatus");
    } else if (customerId) {
      options.indexName = ordersByCustomer;
      options.keyCondition = "customerId = :customerId";
      options.keys.push("customerId");
    } else if (status) {
      options.indexName = ordersByStatus;
      options.keyCondition = "currentStatus = :status";
      options.keys.push("currentStatus");
    }

    if (customerId || status) {
      options.keys.push("orderDate");
      options.attributeValues = {
        ...(customerId ? { ":customerId": customerId } : {}),
        ...(status ? { ":status": status } : {})
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
  };

  private findPlacedOrder = async (id: string) => {
    const { Item: order } = await this.db.send(
      new GetCommand({ TableName: orders, Key: { id }, ConsistentRead: true })
    );
    if (!order) {
      return null;
    }
    if (order.customerId !== this.user.id) {
      throw conflict("Order ID is already in use.");
    }
    return this.toOrderDto(order);
  };

  private toOrderDto = (data: unknown) => {
    const order = parseStored(data, Order);
    const { brand, lastFour } = order.paymentMethod;
    return {
      ...order,
      paymentMethod: { brand, lastFour }
    };
  };

  private toOrderOverview = (data: unknown) => {
    const { products, shipping, ...order } = parseStored(data, SelectedOrder);
    return {
      ...order,
      total: getOrderTotal({ products, shipping }),
      itemCount: getOrderItemCount(products)
    };
  };
}
