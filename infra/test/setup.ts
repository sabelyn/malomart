import "aws-sdk-client-mock-vitest/extend";

Object.assign(process.env, {
  ADMIN_GROUP: "admins",
  ADMIN_SCOPE: "test/admin",
  APP_ORIGIN: "https://malomart.test",
  AWS_REGION: "us-east-1",
  CHARGE_CARD_FUNCTION_NAME: "charge-card",
  CUSTOMER_GROUP: "customers",
  CUSTOMERS_TABLE_NAME: "customers",
  EMAIL_FROM: '"Malo Mart" <noreply@malomart.test>',
  EVENT_BUS_NAME: "order-events",
  IMAGE_BUCKET_NAME: "images",
  IMAGE_KEY_PREFIX: "images/",
  INVALID_RECORDS_QUEUE_URL: "https://sqs.us-east-1.amazonaws.com/123456789012/invalid-records",
  ORDERS_TABLE_NAME: "orders",
  PRODUCTS_TABLE_NAME: "products",
  USER_POOL_ID: "us-east-1_TestPool",
  USER_POOL_CLIENT_ID: "test-client-id",
  VAULT_CARD_TABLE_NAME: "vault-cards",
  VAULT_KEY_ID: "test-key-id"
});
