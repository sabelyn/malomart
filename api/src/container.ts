import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { dbClient, lambdaClient, s3Client } from "@mm/clients";
import { container } from "tsyringe";

import * as tokens from "@/contracts/tokens";
import * as services from "@/services";

export const registerDependencies = () => {
  container.registerInstance(tokens.COGNITO, new CognitoIdentityProviderClient({}));
  container.registerInstance(tokens.DB, dbClient());
  container.registerInstance(tokens.LAMBDA, lambdaClient());
  container.registerInstance(tokens.S3, s3Client());

  container.registerSingleton(tokens.AUTH_SERVICE, services.AuthService);
  container.registerSingleton(tokens.PRODUCT_SERVICE, services.ProductService);

  // Services that depend on the per-request user identity
  container.register(tokens.CUSTOMER_SERVICE, services.CustomerService);
  container.register(tokens.PAYMENT_METHOD_SERVICE, services.PaymentMethodService);
};
