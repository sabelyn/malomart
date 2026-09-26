import type { S3Client } from "@aws-sdk/client-s3";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { InjectionToken } from "tsyringe";

import type { User } from "@/types/user";

export const DB: InjectionToken<DynamoDBDocumentClient> = Symbol("DB");
export const S3: InjectionToken<S3Client> = Symbol("S3");
export const USER: InjectionToken<User> = Symbol("USER");
