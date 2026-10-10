import { IMAGE_KEY_PREFIX } from "@mm/clients/s3";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import {
  AllowedMethods,
  CachePolicy,
  Function as CloudFrontFunction,
  Distribution,
  FunctionCode,
  FunctionEventType,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestCookieBehavior,
  OriginRequestHeaderBehavior,
  OriginRequestPolicy,
  OriginRequestQueryStringBehavior,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { Rule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Architecture, Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { BlockPublicAccess, Bucket, BucketEncryption, HttpMethods } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import path from "node:path";

import type { DbStack } from "./DbStack";
import type { GatewayStack } from "./GatewayStack";

type Props = StackProps & {
  dbStack: DbStack;
  gatewayStack: GatewayStack;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SHARP_VERSION = (require("sharp/package.json") as { version: string }).version;

const uiDist = path.resolve(__dirname, "../../../ui/dist");

const spaRewrite = `
function handler(event) {
  const request = event.request;
  if (!request.uri.includes(".")) {
    request.uri = "/index.html";
  }
  return request;
}
`;

export class FrontendStack extends Stack {
  readonly distribution: Distribution;
  readonly appOrigin: string;
  readonly imageBucket: Bucket;
  readonly uploadBucket: Bucket;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const siteBucket = new Bucket(this, "SiteBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    this.imageBucket = new Bucket(this, "ImageBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    const spaRewriteFunction = new CloudFrontFunction(this, "SpaRewrite", {
      code: FunctionCode.fromInline(spaRewrite)
    });

    this.distribution = new Distribution(this, "Distribution", {
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(siteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: spaRewriteFunction, eventType: FunctionEventType.VIEWER_REQUEST }]
      },
      additionalBehaviors: {
        [`/${IMAGE_KEY_PREFIX}*`]: {
          origin: S3BucketOrigin.withOriginAccessControl(this.imageBucket),
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: CachePolicy.CACHING_OPTIMIZED,
          responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS
        },
        "/api/*": {
          origin: new HttpOrigin(props.gatewayStack.apiDomain, {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: new OriginRequestPolicy(this, "ApiOriginRequestPolicy", {
            headerBehavior: OriginRequestHeaderBehavior.allowList(
              "Accept",
              "Content-Type",
              "Origin",
              "Referer",
              "User-Agent",
              "CloudFront-Viewer-Address"
            ),
            cookieBehavior: OriginRequestCookieBehavior.all(),
            queryStringBehavior: OriginRequestQueryStringBehavior.all()
          }),
          responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS
        }
      },
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100
    });
    this.appOrigin = `https://${this.distribution.distributionDomainName}`;

    this.uploadBucket = new Bucket(this, "UploadBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      eventBridgeEnabled: true,
      lifecycleRules: [{ expiration: Duration.days(1) }],
      cors: [{ allowedMethods: [HttpMethods.POST], allowedOrigins: [this.appOrigin], allowedHeaders: ["*"] }]
    });

    const productsTable = props.dbStack.tables.products;
    const imageProcessor = new NodejsFunction(this, "ImageProcessorFunction", {
      entry: path.resolve(__dirname, "../lambdas/imageProcessor.ts"),
      runtime: Runtime.NODEJS_24_X,
      architecture: Architecture.ARM_64,
      memorySize: 1024,
      timeout: Duration.seconds(30),
      logGroup: new LogGroup(this, "ImageProcessorLogs", {
        retention: RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY
      }),
      bundling: {
        externalModules: ["@aws-sdk/*", "sharp"],
        commandHooks: {
          beforeBundling: () => [],
          beforeInstall: () => [],
          afterBundling: (_, outputDir) => [
            `cd "${outputDir}" && echo {} > package.json`,
            `npm install --prefix "${outputDir}" --no-save --no-package-lock --os=linux --cpu=arm64 --libc=glibc sharp@${SHARP_VERSION}`
          ]
        }
      },
      environment: {
        IMAGE_BUCKET_NAME: this.imageBucket.bucketName,
        PRODUCTS_TABLE_NAME: productsTable.tableName
      }
    });
    this.uploadBucket.grantRead(imageProcessor);
    this.uploadBucket.grantDelete(imageProcessor);
    this.imageBucket.grantPut(imageProcessor);
    this.imageBucket.grantDelete(imageProcessor);
    productsTable.grant(imageProcessor, "dynamodb:UpdateItem");

    new Rule(this, "ImageUploadedRule", {
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: { name: [this.uploadBucket.bucketName] },
          object: { key: [{ prefix: "products/" }] }
        }
      },
      targets: [new LambdaFunction(imageProcessor, { retryAttempts: 2, maxEventAge: Duration.hours(1) })]
    });

    const assetsDeployment = new BucketDeployment(this, "DeployAssets", {
      sources: [Source.asset(path.join(uiDist, "assets"))],
      destinationBucket: siteBucket,
      destinationKeyPrefix: "assets/",
      prune: false,
      cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(Duration.days(365)), CacheControl.immutable()]
    });

    const rootDeployment = new BucketDeployment(this, "DeployRoot", {
      sources: [Source.asset(uiDist, { exclude: ["assets"] })],
      destinationBucket: siteBucket,
      exclude: ["assets/*"],
      cacheControl: [CacheControl.noCache()],
      distribution: this.distribution,
      distributionPaths: ["/*"]
    });
    rootDeployment.node.addDependency(assetsDeployment);

    new CfnOutput(this, "SiteUrl", { value: this.appOrigin });
    new CfnOutput(this, "UploadBucketName", { value: this.uploadBucket.bucketName });
  }
}
