import "reflect-metadata";
import "aws-sdk-client-mock-vitest/extend";

import { container } from "tsyringe";

Object.assign(process.env, {
  ADMIN_SCOPE: "test/admin",
  AWS_REGION: "us-east-1",
  APP_ORIGIN: "http://localhost:5173",
  BUCKET_NAMES: JSON.stringify({ image: "images", uploadStaging: "upload-staging" }),
  INVOKE_FUNCTION_NAMES: JSON.stringify({
    deleteCard: "delete-card",
    describeCard: "describe-card",
    updateCard: "update-card"
  }),
  NODE_ENV: "development",
  OAUTH_DOMAIN: "https://auth.malomart.test",
  PORT: "4000",
  TABLE_INDEXES: JSON.stringify({
    addressesByCustomer: "addresses-by-customer",
    ordersByCustomer: "orders-by-customer",
    ordersByCustomerStatus: "orders-by-customer-status",
    ordersByDate: "orders-by-date",
    ordersByStatus: "orders-by-status",
    paymentMethodsByCustomer: "payment-methods-by-customer",
    productsByCategory: "products-by-category",
    productsByCategoryInStock: "products-by-category-in-stock"
  }),
  TABLE_NAMES: JSON.stringify({
    addresses: "addresses",
    carts: "carts",
    customers: "customers",
    imageUploads: "image-uploads",
    orders: "orders",
    paymentMethods: "payment-methods",
    products: "products"
  }),
  USER_POOL_ID: "us-east-1_TestPool",
  USER_POOL_CLIENT_ID: "test-client-id"
});

afterEach(() => {
  container.reset();
});
