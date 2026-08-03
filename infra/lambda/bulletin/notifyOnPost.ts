import type { DynamoDBStreamHandler } from "aws-lambda";

/**
 * 掲示板の新規投稿・更新通知（5.3.4）
 * 通知対象 = visibleCategoryIds に該当する memberCategoryId を持ち、かつ notificationStatus が ON のユーザー。
 * TODO: Users テーブルをスキャン/クエリして対象ユーザーを絞り込み、PUSH_TOPIC_ARN 経由で送信する。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") continue;
    console.log("bulletin post stream record", record.dynamodb?.NewImage);
  }
};
