import type { EnvInput as ApiEnv } from "@mm/api/env";
import type { RouteAccess } from "@mm/lib";
import { apiRoot, collectEndpoints } from "@mm/lib";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { IHttpRouteAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpMethod, HttpRoute, HttpRouteKey, VpcLink } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaAuthorizer, HttpLambdaResponseType } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpServiceDiscoveryIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { Port, SecurityGroup, SubnetType, Vpc } from "aws-cdk-lib/aws-ec2";
import { Platform } from "aws-cdk-lib/aws-ecr-assets";
import {
  Cluster,
  ContainerImage,
  CpuArchitecture,
  FargateService,
  FargateTaskDefinition,
  LogDriver,
  OperatingSystemFamily
} from "aws-cdk-lib/aws-ecs";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { IBucket } from "aws-cdk-lib/aws-s3";
import { DnsRecordType, PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery";
import type { Construct } from "constructs";
import path from "node:path";

import type { AuthStack } from "./AuthStack";
import type { DbStack } from "./DbStack";
import { INDEXES } from "./DbStack";
import type { GatewayStack } from "./GatewayStack";
import type { VaultStack } from "./VaultStack";

type Props = {
  authStack: AuthStack;
  dbStack: DbStack;
  appOrigin?: string;
  gatewayStack: GatewayStack;
  vaultStack: VaultStack;
  taskCount: number;
  imageBucket?: IBucket;
  uploadBucket?: IBucket;
};

const API_PORT = 4000;
const repoRoot = path.resolve(__dirname, "../../..");

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = new Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [{ name: "Public", subnetType: SubnetType.PUBLIC }]
    });

    const cluster = new Cluster(this, "Cluster", {
      vpc,
      enableFargateCapacityProviders: true
    });

    const namespace = new PrivateDnsNamespace(this, "Namespace", {
      name: "malomart.internal",
      vpc
    });

    const { tables } = props.dbStack;
    const { invokeFunctions } = props.vaultStack;
    const taskDefinition = new FargateTaskDefinition(this, "TaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX
      }
    });
    for (const table of Object.values(tables)) {
      table.grants.readWriteData(taskDefinition.taskRole);
    }
    for (const func of Object.values(invokeFunctions)) {
      func.grantInvoke(taskDefinition.taskRole);
    }
    props.uploadBucket?.grantPut(taskDefinition.taskRole);
    props.imageBucket?.grantDelete(taskDefinition.taskRole);

    const logGroup = new LogGroup(this, "ApiLogs", {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const { userPool, userPoolClient, adminScope } = props.authStack;
    userPool.grant(taskDefinition.taskRole, "cognito-idp:DescribeUserPoolClient");

    const apiEnv = {
      ADMIN_SCOPE: adminScope,
      ...(props.appOrigin ? { APP_ORIGIN: props.appOrigin } : {}),
      BUCKET_NAMES: JSON.stringify({
        ...(props.imageBucket ? { image: props.imageBucket.bucketName } : {}),
        ...(props.uploadBucket ? { uploadStaging: props.uploadBucket.bucketName } : {})
      }),
      INVOKE_FUNCTION_NAMES: JSON.stringify(
        Object.fromEntries(Object.entries(invokeFunctions).map(([key, func]) => [key, func.functionName]))
      ),
      PORT: String(API_PORT),
      TABLE_INDEXES: JSON.stringify(INDEXES),
      TABLE_NAMES: JSON.stringify(
        Object.fromEntries(Object.entries(tables).map(([key, table]) => [key, table.tableName]))
      ),
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId
    } satisfies ApiEnv;
    const container = taskDefinition.addContainer("Api", {
      image: ContainerImage.fromAsset(repoRoot, {
        file: "api/Dockerfile",
        platform: Platform.LINUX_ARM64
      }),
      environment: apiEnv,
      portMappings: [{ containerPort: API_PORT }],
      logging: LogDriver.awsLogs({ logGroup, streamPrefix: "api" }),
      healthCheck: {
        command: [
          "CMD",
          "/nodejs/bin/node",
          "-e",
          `fetch("http://localhost:${API_PORT}/health").then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))`
        ],
        interval: Duration.seconds(30),
        timeout: Duration.seconds(5),
        startPeriod: Duration.seconds(10),
        retries: 3
      }
    });

    const vpcLinkSecurityGroup = new SecurityGroup(this, "VpcLinkSecurityGroup", { vpc });
    const serviceSecurityGroup = new SecurityGroup(this, "ServiceSecurityGroup", { vpc });
    serviceSecurityGroup.addIngressRule(vpcLinkSecurityGroup, Port.tcp(API_PORT), "API Gateway VPC link");

    const service = new FargateService(this, "Service", {
      cluster,
      taskDefinition,
      desiredCount: props.taskCount,
      capacityProviderStrategies: [{ capacityProvider: "FARGATE_SPOT", weight: 1 }],
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      assignPublicIp: true,
      vpcSubnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [serviceSecurityGroup],
      circuitBreaker: { enable: true, rollback: true },
      cloudMapOptions: {
        cloudMapNamespace: namespace,
        name: "api",
        dnsRecordType: DnsRecordType.SRV,
        container,
        containerPort: API_PORT
      }
    });

    const vpcLink = new VpcLink(this, "VpcLink", {
      vpc,
      subnets: { subnetType: SubnetType.PUBLIC },
      securityGroups: [vpcLinkSecurityGroup]
    });

    const cookieAuthorizer = new HttpLambdaAuthorizer("CookieAuthorizer", props.authStack.cookieAuthorizerFunction, {
      responseTypes: [HttpLambdaResponseType.SIMPLE],
      identitySource: [],
      resultsCacheTtl: Duration.seconds(0)
    });

    const { httpApi } = props.gatewayStack;

    const integration = new HttpServiceDiscoveryIntegration("ApiService", service.cloudMapService!, { vpcLink });

    const authorizers: Record<RouteAccess, IHttpRouteAuthorizer | undefined> = {
      public: undefined,
      user: cookieAuthorizer,
      admin: cookieAuthorizer
    };

    for (const endpoint of collectEndpoints(apiRoot)) {
      new HttpRoute(this, `${endpoint.method}${endpoint.fullPath.replace(/\W+/g, "_")}`, {
        httpApi,
        routeKey: HttpRouteKey.with(endpoint.fullPath, endpoint.method as HttpMethod),
        integration,
        authorizer: authorizers[endpoint.access]
      });
    }
  }
}
