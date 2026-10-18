import { apiRoot, Endpoint, Route } from "../api";
import { IdParams } from "../common";
import {
  AdjustStockBody,
  CreateProductBody,
  GetProductsByIdsQuery,
  ImageUploadParams,
  ListProductsQuery,
  ProductImageParams,
  RequestImageUploadPostQuery,
  UpdateProductBody
} from "./requests";
import {
  GetProductsByIdsResponse,
  ImageUploadDto,
  ImageUploadPostResponse,
  ListProductsResponse,
  ProductDto
} from "./responses";

export const products = new Route("/products", "public", ["Products"], apiRoot);

export const getProductsByIds = new Endpoint(products, {
  description: "Retrieves the overviews of several products by their IDs, such as the items in a shopping cart.",
  errors: {
    400: "The IDs were missing, invalid, or too many."
  },
  id: "getProductsByIds",
  method: "GET",
  path: "/batch",
  schemas: { query: GetProductsByIdsQuery, response: GetProductsByIdsResponse },
  successDescription: "The overviews of the products that exist. Missing products are omitted.",
  summary: "Get Products by IDs"
});

export const getProduct = new Endpoint(products, {
  description: "Retrieves a single product by its ID.",
  errors: {
    400: "The ID was not a valid UUID.",
    404: "The product could not be found."
  },
  id: "getProduct",
  method: "GET",
  path: "/{id}",
  schemas: { params: IdParams, response: ProductDto },
  successDescription: "Full product information.",
  summary: "Get a Product"
});

export const listProducts = new Endpoint(products, {
  description: "Returns a list of products paginated by the given limit and optionally filtered by category and stock.",
  errors: {
    400: "The query parameters were invalid."
  },
  id: "listProducts",
  method: "GET",
  path: "/",
  schemas: { query: ListProductsQuery, response: ListProductsResponse },
  successDescription: "A list of product overviews matching the query and pagination information.",
  summary: "List Products"
});

export const createProduct = new Endpoint(products, {
  access: "admin",
  description: "Add a new product to the catalog.",
  errors: {
    400: "Product data was invalid.",
    413: "Product data was too large to store."
  },
  id: "createProduct",
  method: "POST",
  path: "/",
  schemas: { body: CreateProductBody, response: ProductDto },
  successDescription: "The newly created product.",
  successStatus: "201",
  summary: "Create a Product"
});

export const updateProduct = new Endpoint(products, {
  access: "admin",
  description:
    "Update a product's details. Stock and images have their own endpoints. A null original price removes the sale.",
  errors: {
    400: "Product ID or data was invalid.",
    404: "The product could not be found.",
    413: "Product data was too large to store."
  },
  id: "updateProduct",
  method: "PUT",
  path: "/{id}",
  schemas: { body: UpdateProductBody, params: IdParams, response: ProductDto },
  successDescription: "The product after updating.",
  summary: "Update a Product"
});

export const deleteProduct = new Endpoint(products, {
  access: "admin",
  description: "Delete a product from the catalog by ID.",
  errors: {
    400: "The product ID was not a valid UUID."
  },
  id: "deleteProduct",
  method: "DELETE",
  path: "/{id}",
  schemas: { params: IdParams },
  successDescription: "the product was successfully deleted.",
  successStatus: "204",
  summary: "Delete a Product"
});

export const adjustProductStock = new Endpoint(products, {
  access: "admin",
  description: "Add stock to or remove stock from a product.",
  errors: {
    400: "Product ID or change was invalid.",
    404: "The product could not be found.",
    409: "The product doesn't have enough stock to remove."
  },
  id: "adjustProductStock",
  method: "POST",
  path: "/{id}/stock",
  schemas: { body: AdjustStockBody, params: IdParams, response: ProductDto },
  successDescription: "The product after the stock change.",
  summary: "Adjust a Product's Stock"
});

export const requestImageUpload = new Endpoint(products, {
  access: "admin",
  description:
    "Request a presigned URL and fields for a direct post request to S3 for an image upload, along with an upload ID for checking on its processing.",
  errors: {
    400: "Request query is invalid.",
    404: "Product could not be found."
  },
  id: "productImageUpload",
  method: "POST",
  path: "/{id}/images",
  schemas: {
    params: IdParams,
    query: RequestImageUploadPostQuery,
    response: ImageUploadPostResponse
  },
  successDescription: "A presigned URL, form fields, and the upload ID.",
  successStatus: "201",
  summary: "Request a Product Image Upload"
});

export const getImageUpload = new Endpoint(products, {
  access: "admin",
  description:
    "Check whether an uploaded image finished processing. Upload records expire a day after they are requested.",
  errors: {
    400: "Invalid path parameters.",
    404: "The upload could not be found for this product."
  },
  id: "getImageUpload",
  method: "GET",
  path: "/{id}/uploads/{uploadId}",
  schemas: {
    params: ImageUploadParams,
    response: ImageUploadDto
  },
  successDescription: "The upload's processing status.",
  summary: "Get an Image Upload"
});

export const setImageAsThumbnail = new Endpoint(products, {
  access: "admin",
  description: "Set an image as a product's thumbnail.",
  errors: {
    400: "Invalid path parameters.",
    404: "Product or image could not be found."
  },
  id: "setImageAsThumbnail",
  method: "PUT",
  path: "/{id}/images/{hash}",
  schemas: {
    params: ProductImageParams,
    response: ProductDto
  },
  successDescription: "The updated image with new thumbnail.",
  summary: "Set a Product Thumbnail"
});

export const deleteProductImage = new Endpoint(products, {
  access: "admin",
  description: "Delete one of a product's uploaded images.",
  errors: {
    400: "Invalid path parameters.",
    404: "Product could not be found."
  },
  id: "deleteProductImage",
  method: "DELETE",
  path: "/{id}/images/{hash}",
  schemas: {
    params: ProductImageParams,
    response: ProductDto
  },
  successDescription: "The image was successfully deleted.",
  summary: "Delete a Product Image"
});
