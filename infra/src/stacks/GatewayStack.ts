import { CfnOutput, Stack } from "aws-cdk-lib";
import type { StackProps } from "aws-cdk-lib";
import { HttpApi, HttpStage } from "aws-cdk-lib/aws-apigatewayv2";
import type { Construct } from "constructs";

export class GatewayStack extends Stack {
  readonly httpApi: HttpApi;
  readonly apiDomain: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.httpApi = new HttpApi(this, "HttpApi", { createDefaultStage: false });
    new HttpStage(this, "DefaultStage", {
      httpApi: this.httpApi,
      stageName: "$default",
      autoDeploy: true,
      throttle: { rateLimit: 10, burstLimit: 20 }
    });
    this.apiDomain = `${this.httpApi.apiId}.execute-api.${this.region}.${this.urlSuffix}`;

    new CfnOutput(this, "ApiUrl", { value: this.httpApi.apiEndpoint });
  }
}
