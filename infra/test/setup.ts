import "aws-sdk-client-mock-vitest/extend";

Object.assign(process.env, {
  ADMIN_GROUP: "admins",
  ADMIN_SCOPE: "test/admin",
  AWS_REGION: "us-east-1",
  CUSTOMER_GROUP: "customers",
  CUSTOMERS_TABLE_NAME: "customers",
  USER_POOL_ID: "us-east-1_TestPool",
  USER_POOL_CLIENT_ID: "test-client-id",
  VAULT_CARD_TABLE_NAME: "vault-cards",
  VAULT_KEY_ID: "test-key-id"
});
