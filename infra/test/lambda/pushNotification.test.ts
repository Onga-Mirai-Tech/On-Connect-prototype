process.env.USERS_TABLE_NAME = "test-Users";
process.env.CHAT_ROOMS_TABLE_NAME = "test-ChatRooms";
process.env.PUSH_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:123456789012:test-topic";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import type { ChatRoom, Message, User } from "@on-connect/shared";
import { handler } from "../../lambda/messages/pushNotification";

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

const room: ChatRoom = {
  roomId: "room-1",
  isGroup: true,
  name: "テストルーム",
  memberUserIds: ["sender-1", "member-2", "member-3"],
  createdAt: "2026-01-01T00:00:00.000Z",
};

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    messageId: "msg-1",
    roomId: "room-1",
    senderId: "sender-1",
    body: "こんにちは",
    readByUserIds: [],
    status: "sent",
    forceNotify: false,
    createdAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

function buildEvent(message: Message): DynamoDBStreamEvent {
  return {
    Records: [
      {
        eventName: "INSERT",
        dynamodb: { NewImage: marshall(message, { removeUndefinedValues: true }) as never },
      },
    ],
  } as DynamoDBStreamEvent;
}

function mockUsers(users: Pick<User, "userId" | "notificationStatus">[]) {
  for (const user of users) {
    ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: user.userId } }).resolves({ Item: user });
  }
}

beforeEach(() => {
  ddbMock.reset();
  snsMock.reset();
  ddbMock.on(GetCommand, { TableName: "test-ChatRooms", Key: { roomId: "room-1" } }).resolves({ Item: room });
});

test("forceNotifyがtrueの場合、メンションの有無やnotificationStatusを無視してルーム全員に通知する", async () => {
  mockUsers([
    { userId: "member-2", notificationStatus: "OFF" },
    { userId: "member-3", notificationStatus: "OFF" },
  ]);
  const message = buildMessage({ forceNotify: true, mentionedUserIds: ["member-2"] });

  await handler(buildEvent(message), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds.sort()).toEqual(["member-2", "member-3"]);
});

test("mentionedUserIdsが指定されている場合、メンション先のみに通知する（notificationStatusは考慮する）", async () => {
  mockUsers([{ userId: "member-2", notificationStatus: "ON" }]);
  const message = buildMessage({ mentionedUserIds: ["member-2"] });

  await handler(buildEvent(message), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds).toEqual(["member-2"]);
});

test("メンションが無い場合、ルーム全員のうちnotificationStatusがONの人にのみ通知する", async () => {
  mockUsers([
    { userId: "member-2", notificationStatus: "ON" },
    { userId: "member-3", notificationStatus: "OFF" },
  ]);
  const message = buildMessage();

  await handler(buildEvent(message), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds).toEqual(["member-2"]);
});

test("送信者自身はメンション先・ルームメンバーのいずれであっても通知対象から除外される", async () => {
  mockUsers([{ userId: "member-2", notificationStatus: "ON" }]);
  const message = buildMessage({ mentionedUserIds: ["sender-1", "member-2"] });

  await handler(buildEvent(message), {} as never, (() => {}) as never);

  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds).toEqual(["member-2"]);
});

test("通知対象が0人になる場合はSNSにpublishしない", async () => {
  const message = buildMessage({ mentionedUserIds: ["sender-1"] }); // メンション先が送信者のみ

  await handler(buildEvent(message), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});

test("INSERT以外のイベント（MODIFY等）は無視する", async () => {
  const event: DynamoDBStreamEvent = {
    Records: [
      {
        eventName: "MODIFY",
        dynamodb: { NewImage: marshall(buildMessage(), { removeUndefinedValues: true }) as never },
      },
    ],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});
