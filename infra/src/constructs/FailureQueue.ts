import { Duration } from "aws-cdk-lib";
import { Alarm, ComparisonOperator, TreatMissingData } from "aws-cdk-lib/aws-cloudwatch";
import { SnsAction } from "aws-cdk-lib/aws-cloudwatch-actions";
import type { ITopic } from "aws-cdk-lib/aws-sns";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

type Props = {
  description: string;
  alarmTopic: ITopic;
};

export class FailureQueue extends Construct {
  readonly queue: Queue;
  readonly alarm: Alarm;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id);

    this.queue = new Queue(this, "Queue", {
      retentionPeriod: Duration.days(14)
    });

    this.alarm = new Alarm(this, "Alarm", {
      alarmDescription: props.description,
      metric: this.queue.metricApproximateNumberOfMessagesVisible({
        period: Duration.minutes(5),
        statistic: "Maximum"
      }),
      threshold: 0,
      comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: TreatMissingData.NOT_BREACHING
    });
    this.alarm.addAlarmAction(new SnsAction(props.alarmTopic));
  }
}
