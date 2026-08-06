import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import {
  SchedulerClient,
  CreateScheduleCommand,
  DeleteScheduleCommand,
  ResourceNotFoundException,
} from "@aws-sdk/client-scheduler";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamHandler } from "aws-lambda";
import type { Message } from "@on-connect/shared";
import { toTokyoDateTimeString } from "../common/date";

const SCHEDULE_GROUP_NAME = process.env.SCHEDULE_GROUP_NAME!;
const TARGET_LAMBDA_ARN = process.env.TARGET_LAMBDA_ARN!;
const SCHEDULER_ROLE_ARN = process.env.SCHEDULER_ROLE_ARN!;

const schedulerClient = new SchedulerClient({});

/**
 * Messagesテーブルの DynamoDB Streams をトリガーに、EventBridge Scheduler への
 * ワンタイムスケジュールの登録・削除を行う（5.2.2 手順2）。
 * - INSERT かつ status === "scheduled" → CreateSchedule（scheduledAt時刻に発火）
 * - REMOVE、または MODIFY で status が "scheduled" から離脱 → DeleteSchedule（取消・配信完了）
 * スケジュール名は`messageId`単体を使う（`${roomId}_${messageId}`だとUUID2つの連結で
 * EventBridge Schedulerの名前上限64文字を超えるため。messageIdは$util.autoId()が生成する
 * 32文字のUUIDなので単体で安全に収まり、かつ十分に一意）。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName === "INSERT" && record.dynamodb?.NewImage) {
      const message = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as Message;
      if (message.status === "scheduled" && message.scheduledAt) {
        await createSchedule(message);
      }
    } else if (record.eventName === "REMOVE" && record.dynamodb?.OldImage) {
      const message = unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as Message;
      if (message.status === "scheduled") {
        await deleteSchedule(message.messageId);
      }
    } else if (record.eventName === "MODIFY" && record.dynamodb?.OldImage && record.dynamodb?.NewImage) {
      const oldMessage = unmarshall(record.dynamodb.OldImage as Record<string, AttributeValue>) as Message;
      const newMessage = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as Message;
      if (oldMessage.status === "scheduled" && newMessage.status !== "scheduled") {
        await deleteSchedule(newMessage.messageId);
      }
    }
  }
};

async function createSchedule(message: Message): Promise<void> {
  await schedulerClient.send(
    new CreateScheduleCommand({
      Name: message.messageId,
      GroupName: SCHEDULE_GROUP_NAME,
      ScheduleExpression: `at(${toTokyoDateTimeString(message.scheduledAt!)})`,
      ScheduleExpressionTimezone: "Asia/Tokyo",
      FlexibleTimeWindow: { Mode: "OFF" },
      ActionAfterCompletion: "DELETE",
      Target: {
        Arn: TARGET_LAMBDA_ARN,
        RoleArn: SCHEDULER_ROLE_ARN,
        Input: JSON.stringify({ roomId: message.roomId, messageId: message.messageId }),
      },
    }),
  );
}

async function deleteSchedule(messageId: string): Promise<void> {
  try {
    await schedulerClient.send(new DeleteScheduleCommand({ Name: messageId, GroupName: SCHEDULE_GROUP_NAME }));
  } catch (err) {
    if (!(err instanceof ResourceNotFoundException)) throw err;
  }
}
