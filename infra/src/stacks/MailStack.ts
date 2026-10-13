import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import type { IPublicHostedZone } from "aws-cdk-lib/aws-route53";
import { CfnRecordSet, MxRecord, TxtRecord } from "aws-cdk-lib/aws-route53";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { EmailIdentity, Identity, ReceiptRuleSet } from "aws-cdk-lib/aws-ses";
import { S3 } from "aws-cdk-lib/aws-ses-actions";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

type Props = StackProps & {
  zone: IPublicHostedZone;
  inboxDomain: string;
};

export const INBOX_KEY_PREFIX = "mail/";

export class MailStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { zone, inboxDomain } = props;

    new EmailIdentity(this, "DomainIdentity", { identity: Identity.publicHostedZone(zone) });
    new TxtRecord(this, "DmarcRecord", { zone, recordName: "_dmarc", values: ["v=DMARC1; p=none;"] });

    const inboxIdentity = new EmailIdentity(this, "InboxIdentity", { identity: Identity.domain(inboxDomain) });
    [
      [inboxIdentity.dkimDnsTokenName1, inboxIdentity.dkimDnsTokenValue1],
      [inboxIdentity.dkimDnsTokenName2, inboxIdentity.dkimDnsTokenValue2],
      [inboxIdentity.dkimDnsTokenName3, inboxIdentity.dkimDnsTokenValue3]
    ].forEach(([name, value], i) => {
      new CfnRecordSet(this, `InboxDkimRecord${i + 1}`, {
        hostedZoneId: zone.hostedZoneId,
        name,
        type: "CNAME",
        resourceRecords: [value],
        ttl: "1800"
      });
    });

    new MxRecord(this, "InboxMxRecord", {
      zone,
      recordName: inboxDomain,
      values: [{ priority: 10, hostName: `inbound-smtp.${this.region}.amazonaws.com` }]
    });

    const inboxBucket = new Bucket(this, "InboxBucket", {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: Duration.days(7) }]
    });

    const ruleSet = new ReceiptRuleSet(this, "ReceiptRuleSet", {
      rules: [
        {
          recipients: [inboxDomain],
          scanEnabled: true,
          actions: [new S3({ bucket: inboxBucket, objectKeyPrefix: INBOX_KEY_PREFIX })]
        }
      ]
    });

    const activation = new AwsCustomResource(this, "ActivateReceiptRuleSet", {
      onUpdate: {
        service: "SES",
        action: "setActiveReceiptRuleSet",
        parameters: { RuleSetName: ruleSet.receiptRuleSetName },
        physicalResourceId: PhysicalResourceId.of("ActiveReceiptRuleSet")
      },
      onDelete: {
        service: "SES",
        action: "setActiveReceiptRuleSet",
        parameters: {}
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({ resources: AwsCustomResourcePolicy.ANY_RESOURCE }),
      installLatestAwsSdk: false
    });
    activation.node.addDependency(ruleSet);

    new CfnOutput(this, "InboxBucketName", { value: inboxBucket.bucketName });
    new CfnOutput(this, "InboxDomain", { value: inboxDomain });
  }
}
