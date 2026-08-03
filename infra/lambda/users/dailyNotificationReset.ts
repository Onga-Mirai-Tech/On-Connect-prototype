import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

/**
 * 通知ステータスの毎朝自動リセット（EventBridge Scheduler: cron(0 7 * * ? *) Asia/Tokyo）
 * 「つながらない権利」はメンバー自身がその都度OFFにできることで担保されるため、
 * 前日以前にOFFにした状態が翌日以降も無期限に持ち越されないよう、
 * 毎朝7時に notificationStatus を一律 "ON" へ戻す。
 */
export const handler = async () => {
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  let updated = 0;

  do {
    const scanResult = await client.send(
      new ScanCommand({
        TableName: USERS_TABLE_NAME,
        FilterExpression: "notificationStatus = :off",
        ExpressionAttributeValues: { ":off": "OFF" },
        ProjectionExpression: "userId",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );

    const items = scanResult.Items ?? [];
    for (const item of items) {
      await client.send(
        new UpdateCommand({
          TableName: USERS_TABLE_NAME,
          Key: { userId: item.userId },
          UpdateExpression: "SET notificationStatus = :on",
          ExpressionAttributeValues: { ":on": "ON" },
        }),
      );
      updated += 1;
    }

    lastEvaluatedKey = scanResult.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log(`daily notification reset: ${updated} user(s) set to ON`);
};
