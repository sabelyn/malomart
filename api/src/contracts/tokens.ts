import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { LambdaClient } from "@aws-sdk/client-lambda";
import type { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { InjectionToken } from "tsyringe";

import type { User } from "@/types/user";
import type * as contracts from "./index";

export const AUTH_SERVICE: InjectionToken<contracts.IAuthService> = Symbol("AUTH_SERVICE");
export const COGNITO: InjectionToken<CognitoIdentityProviderClient> = Symbol("COGNITO");
export const CUSTOMER_SERVICE: InjectionToken<contracts.ICustomerService> = Symbol("CUSTOMER_SERVICE");
export const DB: InjectionToken<DynamoDBDocumentClient> = Symbol("DB");
export const LAMBDA: InjectionToken<LambdaClient> = Symbol("LAMBDA");
export const ORDER_SERVICE: InjectionToken<contracts.IOrderService> = Symbol("ORDER_SERVICE");
export const PAYMENT_METHOD_SERVICE: InjectionToken<contracts.IPaymentMethodService> = Symbol("PAYMENT_METHOD_SERVICE");
export const PRODUCT_SERVICE: InjectionToken<contracts.IProductService> = Symbol("PRODUCT_SERVICE");
export const S3: InjectionToken<S3Client> = Symbol("S3");
export const USER: InjectionToken<User> = Symbol("USER");
