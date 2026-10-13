import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Fn, RemovalPolicy, Stack } from "aws-cdk-lib";
import { PublicHostedZone } from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";

type Props = StackProps & {
  domainName: string;
};

export class DomainStack extends Stack {
  readonly zone: PublicHostedZone;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    this.zone = new PublicHostedZone(this, "HostedZone", { zoneName: props.domainName });
    this.zone.applyRemovalPolicy(RemovalPolicy.RETAIN);

    new CfnOutput(this, "NameServers", { value: Fn.join(" ", this.zone.hostedZoneNameServers ?? []) });
  }
}
