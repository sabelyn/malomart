import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  FunctionCode,
  FunctionEventType,
  Function as CloudFrontFunction,
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
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import path from "node:path";

import type { GatewayStack } from "./GatewayStack";

type Props = StackProps & {
  gatewayStack: GatewayStack;
};

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

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const bucket = new Bucket(this, "SiteBucket", {
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
        origin: S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: ResponseHeadersPolicy.SECURITY_HEADERS,
        functionAssociations: [{ function: spaRewriteFunction, eventType: FunctionEventType.VIEWER_REQUEST }]
      },
      additionalBehaviors: {
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

    const assetsDeployment = new BucketDeployment(this, "DeployAssets", {
      sources: [Source.asset(path.join(uiDist, "assets"))],
      destinationBucket: bucket,
      destinationKeyPrefix: "assets/",
      prune: false,
      cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(Duration.days(365)), CacheControl.immutable()]
    });

    const rootDeployment = new BucketDeployment(this, "DeployRoot", {
      sources: [Source.asset(uiDist, { exclude: ["assets"] })],
      destinationBucket: bucket,
      exclude: ["assets/*"],
      cacheControl: [CacheControl.noCache()],
      distribution: this.distribution,
      distributionPaths: ["/*"]
    });
    rootDeployment.node.addDependency(assetsDeployment);

    new CfnOutput(this, "SiteUrl", { value: this.appOrigin });
  }
}
