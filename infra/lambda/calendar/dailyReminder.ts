import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { CalendarEvent, User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import { tokyoDateString, toTokyoDateString } from "../common/date";
import { isVisibleToCategory } from "../common/visibility";
import { publishPush } from "../common/push";

const CALENDAR_EVENTS_TABLE_NAME = process.env.CALENDAR_EVENTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const PUSH_TOPIC_ARN = process.env.PUSH_TOPIC_ARN!;

/**
 * カレンダー予定の当日リマインド（EventBridge Scheduler: cron(0 7 * * ? *) Asia/Tokyo、Phase 6）
 * 対象イベント：開始日〜終了日（Asia/Tokyo基準の日付）に今日が含まれる予定（単日・複数日どちらも対象）。
 * 通知対象者：`isVisibleToCategory`で閲覧可能、かつ`notificationStatus === "ON"`のユーザー。
 */
export const handler = async () => {
  const today = tokyoDateString(0);

  const [events, users] = await Promise.all([fetchAllEvents(), fetchAllUsers()]);
  const todaysEvents = events.filter(
    (e) => toTokyoDateString(e.startAt) <= today && today <= toTokyoDateString(e.endAt),
  );

  let published = 0;
  for (const calendarEvent of todaysEvents) {
    const targetUserIds = users
      .filter(
        (u) => isVisibleToCategory(calendarEvent.visibleCategoryIds, u.memberCategoryId) && u.notificationStatus === "ON",
      )
      .map((u) => u.userId);
    if (targetUserIds.length === 0) continue;

    await publishPush(PUSH_TOPIC_ARN, {
      type: "calendar_reminder",
      eventId: calendarEvent.eventId,
      title: calendarEvent.title,
      startAt: calendarEvent.startAt,
      targetUserIds,
    });
    published += 1;
  }

  console.log(`calendar daily reminder: ${todaysEvents.length} event(s) today, ${published} notification(s) published`);
};

async function fetchAllEvents(): Promise<CalendarEvent[]> {
  const result = await docClient.send(new ScanCommand({ TableName: CALENDAR_EVENTS_TABLE_NAME }));
  return (result.Items as CalendarEvent[] | undefined) ?? [];
}

async function fetchAllUsers(): Promise<Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[]> {
  const users: Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE_NAME,
        ProjectionExpression: "userId, memberCategoryId, notificationStatus",
        ExclusiveStartKey: lastEvaluatedKey,
      }),
    );
    users.push(...((result.Items as Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[] | undefined) ?? []));
    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return users;
}
