import { apiRoot, Endpoint, Route } from "../api";
import { IdParams } from "../common";
import { CreateProductBody, ListProductsQuery, UpdateProductBody } from "./requests";
import { ListProductsResponse, ProductDto } from "./responses";

export const products = new Route("/products", "public", ["Products"], apiRoot);

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
  description:
    "Returns a list of products paginated by the given limit and optionally filtered by category in in-stock.",
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
  description: "Update the title, description, and/or price of a product.",
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
