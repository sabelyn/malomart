import type { StackProps } from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { Topic } from "aws-cdk-lib/aws-sns";
import { EmailSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import type { Construct } from "constructs";

type Props = StackProps & {
  alarmEmail?: string;
};

export class AlertsStack extends Stack {
  readonly alarmTopic: Topic;

  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    this.alarmTopic = new Topic(this, "AlarmTopic");
    if (props.alarmEmail) {
      this.alarmTopic.addSubscription(new EmailSubscription(props.alarmEmail));
    }
  }
}
