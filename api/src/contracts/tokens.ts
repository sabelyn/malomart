import type { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import type { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { InjectionToken } from "tsyringe";

import type { User } from "@/types/user";
import type * as contracts from "./index";

export const AUTH_SERVICE: InjectionToken<contracts.IAuthService> = Symbol("AUTH_SERVICE");
export const COGNITO: InjectionToken<CognitoIdentityProviderClient> = Symbol("COGNITO");
export const DB: InjectionToken<DynamoDBDocumentClient> = Symbol("DB");
export const PRODUCT_SERVICE: InjectionToken<contracts.IProductService> = Symbol("PRODUCT_SERVICE");
export const S3: InjectionToken<S3Client> = Symbol("S3");
export const USER: InjectionToken<User> = Symbol("USER");
