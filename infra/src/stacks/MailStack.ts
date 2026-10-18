import type { StackProps } from "aws-cdk-lib";
import { CfnOutput, Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, Metric, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { CloudWatchLogGroup } from "aws-cdk-lib/aws-events-targets";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import type { IPublicHostedZone } from "aws-cdk-lib/aws-route53";
import { CfnRecordSet, MxRecord, TxtRecord } from "aws-cdk-lib/aws-route53";
import {
  ConfigurationSet,
  ConfigurationSetTlsPolicy,
  EmailIdentity,
  EmailSendingEvent,
  EventDestination,
  Identity,
  ReceiptRuleSet,
  SuppressionReasons
} from "aws-cdk-lib/aws-ses";
import { S3 } from "aws-cdk-lib/aws-ses-actions";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import { AwsCustomResource, AwsCustomResourcePolicy, PhysicalResourceId } from "aws-cdk-lib/custom-resources";
import type { Construct } from "constructs";

import { createPrivateBucket } from "../helpers";

type Props = StackProps & {
  zone: IPublicHostedZone;
  inboxDomain: string;
  alarmEmail?: string;
};

export const INBOX_KEY_PREFIX = "mail/";

export class MailStack extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const { zone, inboxDomain } = props;

    const configurationSet = new ConfigurationSet(this, "ConfigurationSet", {
      suppressionReasons: SuppressionReasons.BOUNCES_AND_COMPLAINTS,
      reputationMetrics: true,
      tlsPolicy: ConfigurationSetTlsPolicy.REQUIRE
    });
    configurationSet.addEventDestination("EventBusDestination", {
      destination: EventDestination.eventBus(EventBus.fromEventBusName(this, "DefaultBus", "default")),
      events: [
        EmailSendingEvent.BOUNCE,
        EmailSendingEvent.COMPLAINT,
        EmailSendingEvent.REJECT,
        EmailSendingEvent.RENDERING_FAILURE
      ]
    });

    new Rule(this, "DeliveryProblemsRule", {
      eventPattern: {
        source: ["aws.ses"],
        detailType: ["Email Bounced", "Email Complaint Received", "Email Rejected", "Email Rendering Failed"]
      },
      targets: [
        new CloudWatchLogGroup(
          new LogGroup(this, "DeliveryProblemsLogs", {
            logGroupName: "/aws/events/malomart-mail-delivery-problems",
            retention: RetentionDays.THREE_MONTHS,
            removalPolicy: RemovalPolicy.DESTROY
          })
        )
      ]
    });

    const alarmTopic = new Topic(this, "AlarmTopic");
    if (props.alarmEmail) {
      alarmTopic.addSubscription(new EmailSubscription(props.alarmEmail));
    }
    [
      { id: "BounceRateAlarm", metricName: "Reputation.BounceRate", threshold: 0.03, label: "bounce" },
      { id: "ComplaintRateAlarm", metricName: "Reputation.ComplaintRate", threshold: 0.0005, label: "complaint" }
    ].forEach(({ id, metricName, threshold, label }) => {
      new Alarm(this, id, {
        alarmDescription: `SES ${label} rate is approaching the level where AWS reviews or pauses sending`,
        metric: new Metric({ namespace: "AWS/SES", metricName, statistic: "Maximum", period: Duration.hours(1) }),
        threshold,
        comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        evaluationPeriods: 1,
        treatMissingData: TreatMissingData.NOT_BREACHING
      }).addAlarmAction(new SnsAction(alarmTopic));
    });

    new EmailIdentity(this, "DomainIdentity", {
      identity: Identity.publicHostedZone(zone),
      configurationSet,
      mailFromDomain: `mail.${zone.zoneName}`
    });
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

    const inboxBucket = createPrivateBucket(this, "InboxBucket", {
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
    new CfnOutput(this, "ConfigurationSetName", { value: configurationSet.configurationSetName });
  }
}
