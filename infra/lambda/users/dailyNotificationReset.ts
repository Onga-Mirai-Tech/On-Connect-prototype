import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { User } from "@on-connect/shared";
import { tokyoDateString } from "../common/date";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const MEMBER_DAILY_STATUS_TABLE_NAME = process.env.MEMBER_DAILY_STATUS_TABLE_NAME!;

/**
 * 通知ステータスの毎朝自動リセット（EventBridge Scheduler: cron(0 7 * * ? *) Asia/Tokyo）
 *
 * 休みの人の扱い（休日管理機能との連動）：
 * - 今日から休みが始まる人（今日は休み・昨日は休みでない）→ 強制的にOFFにする（休み入りの自動OFF）
 * - 休みが継続中の人（今日も昨日も休み）→ 何もしない（本人が手動でONに戻していれば、それを尊重する）
 * - 休みでない人（休み明けも含む）→ 従来通り、現在OFFの人をONに戻す
 *   （休み明けの朝はこの分岐に自然に入るので、追加のジョブなしで「休み明け自動ON」が実現できる）
 */
export const handler = async () => {
  const today = tokyoDateString(0);
  const yesterday = tokyoDateString(-1);

  const [leaveToday, leaveYesterday] = await Promise.all([usersOnLeave(today), usersOnLeave(yesterday)]);

  let forcedOff = 0;
  let resetToOn = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const scanResult = await client.send(
      new ScanCommand({
        TableName: USERS_TABLE_NAME,
        ProjectionExpression: "userId, notificationStatus",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    const users = (scanResult.Items as Pick<User, "userId" | "notificationStatus">[] | undefined) ?? [];
    for (const user of users) {
      const isOnLeaveToday = leaveToday.has(user.userId);
      const wasOnLeaveYesterday = leaveYesterday.has(user.userId);

      if (isOnLeaveToday && !wasOnLeaveYesterday) {
        await setNotificationStatus(user.userId, "OFF");
        forcedOff += 1;
      } else if (isOnLeaveToday && wasOnLeaveYesterday) {
        // 休み継続中：本人の設定を維持するため何もしない
      } else if (user.notificationStatus === "OFF") {
        await setNotificationStatus(user.userId, "ON");
        resetToOn += 1;
      }
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(`daily notification reset: ${forcedOff} user(s) forced OFF (leave started), ${resetToOn} user(s) reset to ON`);
};

/** 指定日にleaveTypeが設定されているユーザーIDの集合を返す */
async function usersOnLeave(date: string): Promise<Set<string>> {
  const result = await client.send(
    new QueryCommand({
      TableName: MEMBER_DAILY_STATUS_TABLE_NAME,
      KeyConditionExpression: "#date = :date",
      FilterExpression: "attribute_exists(leaveType)",
      ExpressionAttributeNames: { "#date": "date" },
      ExpressionAttributeValues: { ":date": date },
      ProjectionExpression: "userId",
    }),
  );
  return new Set((result.Items ?? []).map((item) => item.userId as string));
}

async function setNotificationStatus(userId: string, status: "ON" | "OFF"): Promise<void> {
  await client.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { userId },
      UpdateExpression: "SET notificationStatus = :status",
      ExpressionAttributeValues: { ":status": status },
    }),
  );
}
