import type { S3Client } from "@aws-sdk/client-s3";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PaginatedQueryOptions } from "@mm/clients";
import { getPaginatedResults, IMAGE_WIDTHS, imageVariantKey, InvalidCursorError } from "@mm/clients";
import type { CreateProductBody, ListProductsQuery, UpdateProductBody } from "@mm/lib";
import { isDefined, Product, ProductOverview } from "@mm/lib";
import { inject, injectable } from "tsyringe";

import type { IProductService } from "@/contracts";
import { DB, S3 } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, mapConditionFailure, notFound } from "@/errors/helpers";
import { parseStored } from "@/utils/parsing";
import { getPresignedPost } from "@/utils/uploads";

const TableName = env.TABLE_NAMES.products;
const categoryIndex = env.TABLE_INDEXES.productsByCategory;
const { image, uploadStaging } = env.BUCKET_NAMES;

@injectable()
export class ProductService implements IProductService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(S3) private readonly s3: S3Client
  ) {}

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
      Key: { id },
      ReturnValues: "ALL_OLD"
    });
    const result = await this.db.send(command);

    const { imageKeys } = (result.Attributes as Product) ?? {};
    if (imageKeys?.size) {
      await this.deleteImagesFromStorage(...imageKeys);
    }
  };

  deleteProductImage = async (productId: string, imageHash: string) => {
    const imageKey = `products/${productId}/${imageHash}`;
    try {
      const result = await this.db.send(
        new UpdateCommand({
          TableName,
          Key: { id: productId },
          ConditionExpression: "attribute_exists(id)",
          UpdateExpression: "DELETE imageKeys :imageKey",
          ExpressionAttributeValues: { ":imageKey": new Set([imageKey]) },
          ReturnValues: "ALL_NEW"
        })
      );
      if (result.Attributes?.thumbnailKey === imageKey) {
        await this.db.send(
          new UpdateCommand({
            TableName,
            Key: { id: productId },
            ConditionExpression: "attribute_exists(id)",
            UpdateExpression: "REMOVE thumbnailKey"
          })
        );
        result.Attributes.thumbnailKey = undefined;
      }

      await this.deleteImagesFromStorage(imageKey);
      return this.toProductDto(result.Attributes);
    } catch (err) {
      throw mapConditionFailure(err, "Product");
    }
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

  getProductImageUploadPost = async (id: string, contentType?: string) => {
    if (!uploadStaging) {
      throw new Error("The upload staging bucket name has not been configured.");
    }

    // Existence check
    await this.getProduct(id);

    const key = `products/${id}/${crypto.randomUUID()}`;
    const { url, fields } = await getPresignedPost(this.s3, uploadStaging, key, contentType);
    return {
      url,
      fields
    };
  };

  listProducts = async (query: ListProductsQuery) => {
    const { cursor, category, inStock, limit } = query;

    const options: PaginatedQueryOptions = {
      tableName: TableName,
      keys: ["id"],
      limit,
      cursor,
      select: Object.keys(ProductOverview.shape)
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

  setImageAsThumbnail = async (productId: string, imageHash: string) => {
    const imageKey = `products/${productId}/${imageHash}`;
    try {
      const result = await this.db.send(
        new UpdateCommand({
          TableName,
          Key: { id: productId },
          ConditionExpression: "contains(imageKeys, :imageKey)",
          UpdateExpression: "SET thumbnailKey = :imageKey",
          ExpressionAttributeValues: { ":imageKey": imageKey },
          ReturnValues: "ALL_NEW"
        })
      );
      return this.toProductDto(result.Attributes);
    } catch (err) {
      throw mapConditionFailure(err, "Product image");
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
      throw mapConditionFailure(err, "Product");
    }
  };

  private deleteImagesFromStorage = async (...keys: string[]) => {
    image &&
      (await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: image,
          Delete: {
            Objects: keys.flatMap(Key => IMAGE_WIDTHS.map(width => ({ Key: imageVariantKey(Key, width) })))
          }
        })
      ));
  };

  private toProductDto = (data: unknown) => {
    const product = parseStored(data, Product);
    return {
      ...product,
      imageKeys: [...(product.imageKeys ?? [])]
    };
  };

  private toProductsList = (data: unknown[]) => parseStored(data, ProductOverview.array());
}
