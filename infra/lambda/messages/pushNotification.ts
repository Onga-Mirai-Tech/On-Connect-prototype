import type { DynamoDBStreamHandler } from "aws-lambda";

/**
 * 新着チャットのプッシュ通知（5.1.2 / 5.2.3）
 * 判定ロジック：
 *   - forceNotify === true の場合、受信者の notificationStatus を無視して送信する（緊急通知）
 *   - forceNotify === false の場合、notificationStatus === "ON" のユーザーにのみ送信する
 *   - 音声通話の着信通知は本Lambdaの対象外（calls側で別途、例外なくnotificationStatusを尊重する）
 * TODO: Users テーブルから roomId のメンバーの notificationStatus を取得し、
 *       対象ユーザーへ PUSH_TOPIC_ARN 経由で通知をpublishする。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT") continue;
    console.log("new message stream record", record.dynamodb?.NewImage);
  }
};
