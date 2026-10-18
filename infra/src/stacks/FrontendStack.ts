import type { BucketNames } from "@mm/clients/s3";
import { IMAGE_KEY_PREFIX } from "@mm/clients/s3";
import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, Stack } from "aws-cdk-lib";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
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
import { SqsDestination } from "aws-cdk-lib/aws-lambda-destinations";
import { AaaaRecord, ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";
import type { Bucket } from "aws-cdk-lib/aws-s3";
import { HttpMethods } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import path from "node:path";

import { FailureQueue } from "../constructs/FailureQueue";
import { createFunction, createPrivateBucket } from "../helpers";
import type { AlertsStack } from "./AlertsStack";
import type { DbStack } from "./DbStack";
import type { GatewayStack } from "./GatewayStack";

export type SiteDomain = {
  zoneName: string;
  hostName: string;
};

type Props = StackProps & {
  alertsStack: AlertsStack;
  dbStack: DbStack;
  gatewayStack: GatewayStack;
  siteDomain?: SiteDomain;
  localDevOrigin?: string;
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

    const siteBucket = createPrivateBucket(this, "SiteBucket");

    this.imageBucket = createPrivateBucket(this, "ImageBucket");

    const spaRewriteFunction = new CloudFrontFunction(this, "SpaRewrite", {
      code: FunctionCode.fromInline(spaRewrite)
    });

    const site = props.siteDomain && {
      hostName: props.siteDomain.hostName,
      zone: HostedZone.fromLookup(this, "HostedZone", { domainName: props.siteDomain.zoneName })
    };
    const certificate =
      site &&
      new DnsValidatedCertificate(this, "SiteCertificate", {
        domainName: site.hostName,
        hostedZone: site.zone,
        region: "us-east-1",
        cleanupRoute53Records: true
      });

    this.distribution = new Distribution(this, "Distribution", {
      domainNames: site && [site.hostName],
      certificate,
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
    if (site) {
      const target = RecordTarget.fromAlias(new CloudFrontTarget(this.distribution));
      new ARecord(this, "SiteARecord", { zone: site.zone, recordName: site.hostName, target });
      new AaaaRecord(this, "SiteAaaaRecord", { zone: site.zone, recordName: site.hostName, target });
    }
    this.appOrigin = `https://${site?.hostName ?? this.distribution.distributionDomainName}`;

    this.uploadBucket = createPrivateBucket(this, "UploadBucket", {
      eventBridgeEnabled: true,
      lifecycleRules: [{ expiration: Duration.days(1) }],
      cors: [
        {
          allowedMethods: [HttpMethods.POST],
          allowedOrigins: [this.appOrigin, ...(props.localDevOrigin ? [props.localDevOrigin] : [])],
          allowedHeaders: ["*"]
        }
      ]
    });

    const { imageUploads: imageUploadsTable, products: productsTable } = props.dbStack.tables;
    const imageProcessorFailures = new FailureQueue(this, "ImageProcessorFailures", {
      description: "Product image uploads failed to process",
      alarmTopic: props.alertsStack.alarmTopic
    });
    const imageProcessor = createFunction(this, "ImageProcessor", "imageProcessor", {
      memorySize: 1024,
      timeout: Duration.seconds(30),
      retryAttempts: 2,
      onFailure: new SqsDestination(imageProcessorFailures.queue),
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
        IMAGE_UPLOADS_TABLE_NAME: imageUploadsTable.tableName,
        PRODUCTS_TABLE_NAME: productsTable.tableName
      }
    });
    this.uploadBucket.grantRead(imageProcessor);
    this.uploadBucket.grantDelete(imageProcessor);
    this.imageBucket.grantPut(imageProcessor);
    this.imageBucket.grantDelete(imageProcessor);
    productsTable.grant(imageProcessor, "dynamodb:UpdateItem");
    imageUploadsTable.grant(imageProcessor, "dynamodb:UpdateItem");

    new Rule(this, "ImageUploadedRule", {
      eventPattern: {
        source: ["aws.s3"],
        detailType: ["Object Created"],
        detail: {
          bucket: { name: [this.uploadBucket.bucketName] },
          object: { key: [{ prefix: "products/" }] }
        }
      },
      targets: [
        new LambdaFunction(imageProcessor, {
          retryAttempts: 2,
          maxEventAge: Duration.hours(1),
          deadLetterQueue: imageProcessorFailures.queue
        })
      ]
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
    const bucketNames: BucketNames = {
      image: this.imageBucket.bucketName,
      uploadStaging: this.uploadBucket.bucketName
    };
    new CfnOutput(this, "BucketNames", { value: this.toJsonString(bucketNames) });
  }
}
