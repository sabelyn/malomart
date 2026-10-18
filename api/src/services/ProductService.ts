import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import type { S3Client } from "@aws-sdk/client-s3";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DeleteCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { PaginatedQueryOptions } from "@mm/clients";
import {
  getItemById,
  getItemsByIds,
  getPaginatedResults,
  IMAGE_WIDTHS,
  imageVariantKey,
  InvalidCursorError,
  productImageKey
} from "@mm/clients";
import type { CreateProductBody, ListProductsQuery, ProductDto, UpdateProductBody } from "@mm/lib";
import { ImageUpload, ImageUploadStatus, isDefined, Product, ProductOverview } from "@mm/lib";
import { inject, injectable } from "tsyringe";

import type { IProductService } from "@/contracts";
import { DB, S3 } from "@/contracts/tokens";
import env from "@/env";
import { badRequest, conflict, mapConditionFailure, notFound } from "@/errors/helpers";
import { parseStored } from "@/utils/parsing";
import { getPresignedPost } from "@/utils/uploads";

const TableName = env.TABLE_NAMES.products;
const UploadsTableName = env.TABLE_NAMES.imageUploads;
const { productsByCategory, productsByCategoryInStock } = env.TABLE_INDEXES;
const { image, uploadStaging } = env.BUCKET_NAMES;

const UPLOAD_RECORD_TTL_SECONDS = 24 * 60 * 60;

@injectable()
export class ProductService implements IProductService {
  constructor(
    @inject(DB) private readonly db: DynamoDBDocumentClient,
    @inject(S3) private readonly s3: S3Client
  ) {}

  adjustStock = async (id: string, change: number) => {
    const values: Record<string, number> = { ":change": change };
    let ConditionExpression = "attribute_exists(id)";
    if (change < 0) {
      ConditionExpression += " AND stockCount >= :needed";
      values[":needed"] = -change;
    }

    try {
      const result = await this.db.send(
        new UpdateCommand({
          TableName,
          Key: { id },
          ConditionExpression,
          UpdateExpression: "ADD stockCount :change",
          ExpressionAttributeValues: values,
          ReturnValues: "ALL_NEW",
          ReturnValuesOnConditionCheckFailure: "ALL_OLD"
        })
      );
      return this.toProductDto(result.Attributes);
    } catch (err) {
      if (err instanceof ConditionalCheckFailedException && err.Item) {
        const stockCount = err.Item.stockCount?.N ?? "0";
        throw conflict(`Can't remove ${-change} when only ${stockCount} in stock.`, err);
      }
      throw mapConditionFailure(err, "Product");
    }
  };

  createProduct = async (data: CreateProductBody) => {
    const Item: Product = {
      id: crypto.randomUUID(),
      ...data,
      inStock: data.stockCount > 0 ? 1 : 0
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
    const imageKey = productImageKey(productId, imageHash);
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

  getImageUpload = async (productId: string, uploadId: string) => {
    const result = await getItemById(this.db, UploadsTableName, uploadId);
    if (!result) {
      throw notFound("Upload could not be found.");
    }
    const { productId: uploadProductId, expiresAt: _, ...upload } = parseStored(result, ImageUpload);
    if (uploadProductId !== productId) {
      throw notFound("Upload could not be found.");
    }
    return upload;
  };

  getProduct = async (id: string) => {
    const result = await getItemById<ProductDto>(this.db, TableName, id);
    if (!result) {
      throw notFound("Product could not be found.");
    }

    return this.toProductDto(result);
  };

  getProductImageUploadPost = async (id: string, contentType?: string) => {
    // Existence check
    await this.getProduct(id);

    const uploadId = crypto.randomUUID();
    const upload: ImageUpload = {
      id: uploadId,
      productId: id,
      status: ImageUploadStatus.Pending,
      expiresAt: Math.floor(Date.now() / 1000) + UPLOAD_RECORD_TTL_SECONDS
    };
    await this.db.send(new PutCommand({ TableName: UploadsTableName, Item: upload }));

    const key = `products/${id}/${uploadId}`;
    const { url, fields } = await getPresignedPost(this.s3, uploadStaging, key, contentType);
    return {
      url,
      fields,
      uploadId
    };
  };

  getProducts = async (ids: string[]) => {
    if (ids.length === 0) {
      return [];
    }

    const select = Object.keys(ProductOverview.shape).join(", ");
    if (ids.length === 1) {
      const product = await getItemById<ProductOverview>(this.db, TableName, ids[0], "id", select);
      return product ? [product] : [];
    }

    return getItemsByIds<ProductOverview>(this.db, TableName, ids, select);
  };

  getProductStocks = async (ids: string[]) => {
    if (ids.length === 0) {
      return {};
    }
    const results = await getItemsByIds<{ id: string; stockCount: number }>(this.db, TableName, ids, "id, stockCount");
    return Object.fromEntries(results.map(({ id, stockCount }) => [id, stockCount]));
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
    const hasStockFilter = isDefined(inStock);
    if (category && hasStockFilter) {
      options.indexName = productsByCategoryInStock;
      options.keys = ["category", "inStock", "id"];
      options.keyCondition = "category = :cat AND inStock = :inStock";
      attributeValues[":cat"] = category;
      attributeValues[":inStock"] = inStock ? 1 : 0;
    } else if (category) {
      options.indexName = productsByCategory;
      options.keys = ["category", "id"];
      options.keyCondition = "category = :cat";
      attributeValues[":cat"] = category;
    } else if (hasStockFilter) {
      options.filter = "inStock = :inStock";
      attributeValues[":inStock"] = inStock ? 1 : 0;
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
    const imageKey = productImageKey(productId, imageHash);
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
    const set: string[] = [];
    const remove: string[] = [];
    const names: Record<string, string> = {};
    const values: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      if (!isDefined(value)) {
        continue;
      }
      names[`#${key}`] = key;
      if (value === null) {
        remove.push(`#${key}`);
        continue;
      }
      set.push(`#${key} = :${key}`);
      values[`:${key}`] = value;
    }

    const clauses = [];
    if (set.length) {
      clauses.push(`SET ${set.join(", ")}`);
    }
    if (remove.length) {
      clauses.push(`REMOVE ${remove.join(", ")}`);
    }

    const command = new UpdateCommand({
      TableName,
      Key: { id },
      ConditionExpression: "attribute_exists(id)",
      UpdateExpression: clauses.join(" "),
      ExpressionAttributeNames: names,
      ...(set.length ? { ExpressionAttributeValues: values } : {}),
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
    await this.s3.send(
      new DeleteObjectsCommand({
        Bucket: image,
        Delete: {
          Objects: keys.flatMap(Key => IMAGE_WIDTHS.map(width => ({ Key: imageVariantKey(Key, width) })))
        }
      })
    );
  };

  private toProductDto = (data: unknown) => {
    const { inStock: _, ...product } = parseStored(data, Product);
    return {
      ...product,
      imageKeys: [...(product.imageKeys ?? [])]
    };
  };

  private toProductsList = (data: unknown[]) => parseStored(data, ProductOverview.array());
}
