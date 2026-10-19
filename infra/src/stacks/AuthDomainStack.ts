import type { StackProps } from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { DnsValidatedCertificate } from "aws-cdk-lib/aws-certificatemanager";
import type { IUserPool } from "aws-cdk-lib/aws-cognito";
import { UserPoolDomain } from "aws-cdk-lib/aws-cognito";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { UserPoolDomainTarget } from "aws-cdk-lib/aws-route53-targets";
import type { Construct } from "constructs";

import type { SiteDomain } from "./FrontendStack";

type Props = StackProps & {
  userPool: IUserPool;
  authDomain: SiteDomain;
};

export class AuthDomainStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { authDomain } = props;
    const zone = HostedZone.fromLookup(this, "HostedZone", { domainName: authDomain.zoneName });
    const certificate = new DnsValidatedCertificate(this, "Certificate", {
      domainName: authDomain.hostName,
      hostedZone: zone,
      region: "us-east-1",
      cleanupRoute53Records: true
    });
    const domain = new UserPoolDomain(this, "Domain", {
      userPool: props.userPool,
      customDomain: { domainName: authDomain.hostName, certificate }
    });
    new ARecord(this, "ARecord", {
      zone,
      recordName: authDomain.hostName,
      target: RecordTarget.fromAlias(new UserPoolDomainTarget(domain))
    });
  }
}
