import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Handler } from "aws-lambda";
import { docClient } from "../common/dynamo";
import { callAppSyncGraphQL } from "../common/appsyncSigner";

const MESSAGES_TABLE_NAME = process.env.MESSAGES_TABLE_NAME!;
const CHAT_API_URL = process.env.CHAT_API_URL!;

interface ScheduledMessagePayload {
  roomId: string;
  messageId: string;
}

const deliverScheduledMessageMutation = `mutation DeliverScheduledMessage($roomId: ID!, $messageId: ID!) {
  deliverScheduledMessage(roomId: $roomId, messageId: $messageId) {
    messageId
  }
}`;

/**
 * 予約送信（5.2.2 手順3）
 * EventBridge Schedulerから指定時刻に起動され、Messagesテーブルの該当項目を status: sent に
 * 更新する。ConditionExpressionで「まだscheduledのままか」を確認し、既に取消
 * （cancelScheduledMessageによるREMOVE）済みなら何もしない（誤送信防止）。
 * 更新後、AppSyncのdeliverScheduledMessageミューテーションをIAM署名付きで呼び出し、
 * onMessageSent購読を発火させてチャットルームへリアルタイム配信する（設計書5.2.2手順3）。
 * プッシュ通知自体はMessagesテーブルのStreamsをトリガーにpushNotification.ts側が処理する
 * （このLambdaはstatus更新と配信トリガーのみを担う）。
 *
 * 注：EventBridge SchedulerがLambdaターゲットを直接起動する場合、Target.Inputに指定したJSONは
 * `event.detail`にラップされず、そのままイベントオブジェクトそのものとして渡される
 * （`.detail`ラップはEventBridge Rules＝イベントバス経由の呼び出しの場合の話で、Scheduler直起動には
 * 適用されない。実デプロイでの実地検証で発覚：`ScheduledHandler`型を使い`event.detail`を
 * 参照していたため、実際には`event.detail`がundefinedとなり毎回失敗していた）。
 */
export const handler: Handler<ScheduledMessagePayload, void> = async (event) => {
  const { roomId, messageId } = event;

  try {
    await docClient.send(
      new UpdateCommand({
        TableName: MESSAGES_TABLE_NAME,
        Key: { roomId, messageId },
        UpdateExpression: "SET #status = :sent",
        ConditionExpression: "#status = :scheduled",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":sent": "sent", ":scheduled": "scheduled" },
      }),
    );
  } catch (err) {
    if (err instanceof Error && err.name === "ConditionalCheckFailedException") {
      console.log(`message already delivered or cancelled: roomId=${roomId} messageId=${messageId}`);
      return;
    }
    throw err;
  }

  await callAppSyncGraphQL(CHAT_API_URL, deliverScheduledMessageMutation, { roomId, messageId });
};
