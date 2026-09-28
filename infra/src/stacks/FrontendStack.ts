import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import {
  CachePolicy,
  Distribution,
  FunctionCode,
  FunctionEventType,
  Function as CloudFrontFunction,
  HttpVersion,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, CacheControl, Source } from "aws-cdk-lib/aws-s3-deployment";
import type { Construct } from "constructs";
import path from "node:path";

type Props = StackProps & {
  runtimeConfig?: Record<string, string>;
};

const uiDist = path.resolve(__dirname, "../../../ui/dist");

const spaRewrite = `
function handler(event) {
  var request = event.request;
  if (!request.uri.includes(".")) {
    request.uri = "/index.html";
  }
  return request;
}
`;

export class FrontendStack extends Stack {
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, props?: Props) {
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
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100
    });

    const assetsDeployment = new BucketDeployment(this, "DeployAssets", {
      sources: [Source.asset(path.join(uiDist, "assets"))],
      destinationBucket: bucket,
      destinationKeyPrefix: "assets/",
      prune: false,
      cacheControl: [CacheControl.setPublic(), CacheControl.maxAge(Duration.days(365)), CacheControl.immutable()]
    });

    const rootSources = [Source.asset(uiDist, { exclude: ["assets"] })];
    if (props?.runtimeConfig) {
      rootSources.push(Source.jsonData("config.json", props.runtimeConfig));
    }

    const rootDeployment = new BucketDeployment(this, "DeployRoot", {
      sources: rootSources,
      destinationBucket: bucket,
      exclude: ["assets/*"],
      cacheControl: [CacheControl.noCache()],
      distribution: this.distribution,
      distributionPaths: ["/*"]
    });
    rootDeployment.node.addDependency(assetsDeployment);

    new CfnOutput(this, "SiteUrl", { value: `https://${this.distribution.distributionDomainName}` });
  }
}
