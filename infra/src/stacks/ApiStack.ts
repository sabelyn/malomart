import path from "node:path";

import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi, HttpMethod, HttpNoneAuthorizer, VpcLink } from "aws-cdk-lib/aws-apigatewayv2";
import type { IHttpRouteAuthorizer } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpUserPoolAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
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
import { DnsRecordType, PrivateDnsNamespace } from "aws-cdk-lib/aws-servicediscovery";
import type { Construct } from "constructs";

import type { AuthStack } from "./AuthStack";

type Props = {
  authStack: AuthStack;
};

type RouteAccess = "public" | "user" | "admin";

type RouteConfig = {
  path: string;
  methods: HttpMethod[];
  access: RouteAccess;
};

const routes: RouteConfig[] = [
  { path: "/products", methods: [HttpMethod.GET], access: "public" },
  { path: "/products/{id}", methods: [HttpMethod.GET], access: "public" },
  { path: "/products", methods: [HttpMethod.POST], access: "admin" },
  { path: "/products/{proxy+}", methods: [HttpMethod.ANY], access: "admin" },
  { path: "/orders", methods: [HttpMethod.GET, HttpMethod.POST], access: "user" },
  { path: "/orders/{id}", methods: [HttpMethod.GET], access: "user" },
  { path: "/orders/{id}/status", methods: [HttpMethod.PUT], access: "admin" }
];

const API_PORT = 4000;
const FRONTEND_URL = "http://localhost:3000";
const repoRoot = path.resolve(__dirname, "../../..");

export class ApiStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    const vpc = new Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        { name: "Public", subnetType: SubnetType.PUBLIC }
      ]
    });

    const cluster = new Cluster(this, "Cluster", {
      vpc,
      enableFargateCapacityProviders: true
    });

    const namespace = new PrivateDnsNamespace(this, "Namespace", {
      name: "malomart.internal",
      vpc
    });

    const taskDefinition = new FargateTaskDefinition(this, "TaskDefinition", {
      cpu: 256,
      memoryLimitMiB: 512,
      runtimePlatform: {
        cpuArchitecture: CpuArchitecture.ARM64,
        operatingSystemFamily: OperatingSystemFamily.LINUX
      }
    });

    const logGroup = new LogGroup(this, "ApiLogs", {
      retention: RetentionDays.ONE_WEEK,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const { userPool, userPoolClient, adminScope } = props.authStack;
    const container = taskDefinition.addContainer("Api", {
      image: ContainerImage.fromAsset(repoRoot, {
        file: "api/Dockerfile",
        platform: Platform.LINUX_ARM64
      }),
      environment: {
        ADMIN_SCOPE: adminScope,
        FRONTEND_URL,
        PORT: String(API_PORT),
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId
      },
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
      desiredCount: 1,
      capacityProviderStrategies: [
        { capacityProvider: "FARGATE_SPOT", weight: 1 }
      ],
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

    const userPoolAuthorizer = new HttpUserPoolAuthorizer("UserPoolAuthorizer", userPool, {
      userPoolClients: [userPoolClient]
    });
    const noneAuthorizer = new HttpNoneAuthorizer();

    const httpApi = new HttpApi(this, "HttpApi", {
      defaultAuthorizer: userPoolAuthorizer,
      corsPreflight: {
        allowOrigins: [FRONTEND_URL],
        allowHeaders: ["Content-Type", "Authorization"],
        allowMethods: [
          CorsHttpMethod.GET,
          CorsHttpMethod.POST,
          CorsHttpMethod.PUT,
          CorsHttpMethod.PATCH,
          CorsHttpMethod.DELETE
        ],
        maxAge: Duration.hours(1)
      }
    });

    const integration = new HttpServiceDiscoveryIntegration("ApiService", service.cloudMapService!, { vpcLink });

    const accessSettings: Record<RouteAccess, { authorizer?: IHttpRouteAuthorizer; authorizationScopes?: string[] }> = {
      public: { authorizer: noneAuthorizer },
      user: {},
      admin: { authorizationScopes: [adminScope] }
    };

    for (const route of routes) {
      httpApi.addRoutes({ path: route.path, methods: route.methods, integration, ...accessSettings[route.access] });
    }

    new CfnOutput(this, "ApiUrl", { value: httpApi.apiEndpoint });
  }
}
