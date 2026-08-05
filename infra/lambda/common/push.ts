import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({});

/** PUSH_TOPIC_ARN 宛にプッシュ通知ペイロードをpublishする共通ヘルパー */
export async function publishPush(topicArn: string, payload: Record<string, unknown>): Promise<void> {
  await snsClient.send(
    new PublishCommand({
      TopicArn: topicArn,
      Message: JSON.stringify(payload),
    }),
  );
}
