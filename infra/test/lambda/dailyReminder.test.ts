process.env.CALENDAR_EVENTS_TABLE_NAME = "test-CalendarEvents";
process.env.USERS_TABLE_NAME = "test-Users";
process.env.PUSH_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:123456789012:test-topic";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import type { CalendarEvent, User } from "@on-connect/shared";
import { tokyoDateString } from "../../lambda/common/date";
import { handler } from "../../lambda/calendar/dailyReminder";

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

const today = tokyoDateString(0);
const yesterday = tokyoDateString(-1);
const tomorrow = tokyoDateString(1);
const dayAfterTomorrow = tokyoDateString(2);

function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    eventId: "e1",
    title: "今日の予定",
    startAt: `${today}T09:00:00+09:00`,
    endAt: `${today}T10:00:00+09:00`,
    visibleCategoryIds: [],
    authorId: "author-1",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function mockEvents(events: CalendarEvent[]) {
  ddbMock.on(ScanCommand, { TableName: "test-CalendarEvents" }).resolves({ Items: events });
}

function mockUsers(users: Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[]) {
  ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: users });
}

beforeEach(() => {
  ddbMock.reset();
  snsMock.reset();
});

test("今日開催の単日イベントは、閲覧可能かつ通知ONのユーザーにのみリマインドする", async () => {
  mockEvents([buildEvent()]);
  mockUsers([
    { userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" },
    { userId: "u2", memberCategoryId: "cat-a", notificationStatus: "OFF" },
  ]);

  await handler();

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.type).toBe("calendar_reminder");
  expect(payload.eventId).toBe("e1");
  expect(payload.targetUserIds).toEqual(["u1"]);
});

test("今日を含む複数日イベント（開始日は過去、終了日は未来）もリマインド対象になる", async () => {
  mockEvents([
    buildEvent({ startAt: `${yesterday}T09:00:00+09:00`, endAt: `${tomorrow}T17:00:00+09:00` }),
  ]);
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" }]);

  await handler();

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
});

test("今日を含まないイベント（開始・終了とも未来）はリマインド対象外", async () => {
  mockEvents([buildEvent({ startAt: `${tomorrow}T09:00:00+09:00`, endAt: `${dayAfterTomorrow}T10:00:00+09:00` })]);
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" }]);

  await handler();

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});

test("visibleCategoryIdsで閲覧範囲が限定されている場合、対象カテゴリー以外のユーザーには通知しない", async () => {
  mockEvents([buildEvent({ visibleCategoryIds: ["cat-fulltime"] })]);
  mockUsers([
    { userId: "u1", memberCategoryId: "cat-fulltime", notificationStatus: "ON" },
    { userId: "u2", memberCategoryId: "cat-parttime", notificationStatus: "ON" },
  ]);

  await handler();

  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds).toEqual(["u1"]);
});

test("対象ユーザーが0人（全員notificationStatus OFF）ならSNSにpublishしない", async () => {
  mockEvents([buildEvent()]);
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "OFF" }]);

  await handler();

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});
