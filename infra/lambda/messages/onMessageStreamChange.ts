import type { DynamoDBStreamHandler } from "aws-lambda";

/**
 * Messagesテーブルの DynamoDB Streams をトリガーに、EventBridge Scheduler への
 * ワンタイムスケジュールの登録・削除を行う（5.2.2 手順2）。
 *
 * - INSERT かつ status === "scheduled" → CreateSchedule（scheduledAt時刻に発火）
 * - REMOVE、または MODIFY で status が "scheduled" から変化 → DeleteSchedule（取消・編集対応）
 *
 * スケジュール名は `${roomId}_${messageId}` のように一意なキーから決定する運用を想定。
 * TODO: @aws-sdk/client-scheduler を用いた CreateSchedule/DeleteSchedule 呼び出しを実装する。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    console.log(`messages stream event: ${record.eventName}`);
    // TODO: record.dynamodb.NewImage / OldImage を見て CreateSchedule / DeleteSchedule を呼び分ける
  }
};
