import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PaginatedQueryOptions } from "@mm/clients";
import { getPaginatedResults, InvalidCursorError } from "@mm/clients";
import type { CreateProductBody, ListProductsQuery, Product, UpdateProductBody } from "@mm/lib";
import { isDefined, ProductDto, ProductOverview } from "@mm/lib";
import { inject, injectable } from "tsyringe";
import { ZodError } from "zod";

import type { IProductService } from "@/contracts";
import { DB } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, internal, notFound } from "@/errors/helpers";

const TableName = env.TABLE_NAMES.products;
const categoryIndex = env.TABLE_INDEXES.productsByCategory;

@injectable()
export class ProductService implements IProductService {
  constructor(@inject(DB) private readonly db: DynamoDBDocumentClient) { }

  createProduct = async (data: CreateProductBody) => {
    const Item: Product = {
      id: crypto.randomUUID(),
      ...data
    };

    const command = new PutCommand({
      TableName,
      Item
    });

    await this.db.send(command);
    return this.toProductDto(Item);
  };

  deleteProduct = async (id: string) => {
    const command = new DeleteCommand({
      TableName,
      Key: { id }
    });
    await this.db.send(command);
  };

  getProduct = async (id: string) => {
    const command = new GetCommand({
      TableName,
      Key: { id }
    });

    const response = await this.db.send(command);
    if (!response.Item) {
      throw notFound("Product could not be found.");
    }

    return this.toProductDto(response.Item);
  };

  listProducts = async (query: ListProductsQuery) => {
    const { cursor, category, inStock, limit } = query;

    const options: PaginatedQueryOptions = {
      tableName: TableName,
      keys: ["id"],
      limit,
      cursor,
      select: ["id", "title", "price"]
    };
    const attributeValues: Record<string, unknown> = {};
    if (category) {
      options.indexName = categoryIndex;
      options.keys = ["category", "id"];
      options.keyCondition = "category = :cat";
      attributeValues[":cat"] = category;
    }
    if (inStock) {
      options.filter = "inStock > :zero";
      attributeValues[":zero"] = 0;
    }
    if (Object.keys(attributeValues).length > 0) {
      options.attributeValues = attributeValues;
    }

    try {
      const results = await getPaginatedResults(this.db, options);
      return {
        data: this.toProductsList(results.items),
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

  updateProduct = async (id: string, data: UpdateProductBody) => {
    const { title, description, price } = data;

    const exp: string[] = [];
    const values: Record<string, unknown> = {};
    if (isDefined(title)) {
      exp.push("title = :title");
      values[":title"] = title;
    }
    if (isDefined(description)) {
      exp.push("description = :desc");
      values[":desc"] = description;
    }
    if (isDefined(price)) {
      exp.push("price = :price");
      values[":price"] = price;
    }

    const command = new UpdateCommand({
      TableName,
      Key: { id },
      ConditionExpression: "attribute_exists(id)",
      UpdateExpression: `SET ${exp.join(", ")}`,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW"
    });

    try {
      const response = await this.db.send(command);
      return this.toProductDto(response.Attributes);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException) {
        throw notFound("Product could not be found.");
      }
      throw err;
    }
  };

  private toProductDto = (data: unknown) => this.parseStored(() => ProductDto.parse(data));

  private toProductsList = (data: unknown[]) => this.parseStored(() => ProductOverview.array().parse(data));

  private parseStored = <T>(parse: () => T): T => {
    try {
      return parse();
    } catch (err) {
      if (err instanceof ZodError) {
        throw internal(err);
      }
      throw err;
    }
  };
}
