import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import type { NodejsFunctionProps } from "aws-cdk-lib/aws-lambda-nodejs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { BucketProps } from "aws-cdk-lib/aws-s3";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import type { Construct } from "constructs";
import path from "node:path";

export const createFunction = (scope: Construct, name: string, entry: string, overrides: NodejsFunctionProps = {}) =>
  new NodejsFunction(scope, `${name}Function`, {
    entry: path.resolve(__dirname, `lambdas/${entry}.ts`),
    runtime: Runtime.NODEJS_24_X,
    architecture: Architecture.ARM_64,
    timeout: Duration.seconds(3),
    logGroup: new LogGroup(scope, `${name}Logs`, {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    }),
    ...overrides
  });

export const createPrivateBucket = (scope: Construct, id: string, overrides: BucketProps = {}) =>
  new Bucket(scope, id, {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    enforceSSL: true,
    removalPolicy: RemovalPolicy.DESTROY,
    autoDeleteObjects: true,
    ...overrides
  });
