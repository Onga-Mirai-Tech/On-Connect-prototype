import type { ScheduledHandler } from "aws-lambda";

interface ScheduledMessagePayload {
  roomId: string;
  messageId: string;
}

/**
 * 予約送信（5.2.2 手順3）
 * EventBridge Schedulerから指定時刻に起動され、Messagesテーブルの該当項目を
 * status: sent に更新する。実配信（AppSync Subscription経由でのチャットルームへの
 * 配信）は、IAM認証付きの内部mutation呼び出しで行う想定（TODO）。
 * プッシュ通知処理自体は Messages テーブルの Streams をトリガーに
 * NotificationConstruct 側のLambdaが行う（このLambdaはstatus更新のみを担う）。
 */
export const handler: ScheduledHandler<ScheduledMessagePayload> = async (event) => {
  const { roomId, messageId } = event.detail;

  // TODO: DynamoDB UpdateItem で status を "sent" に更新する
  console.log(`send scheduled message roomId=${roomId} messageId=${messageId}`);
};
