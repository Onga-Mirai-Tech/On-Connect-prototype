process.env.USERS_TABLE_NAME = "test-Users";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SNSEvent } from "aws-lambda";
import { handler } from "../../lambda/notifications/deliverPush";

const ddbMock = mockClient(DynamoDBDocumentClient);

function buildEvent(payload: Record<string, unknown>): SNSEvent {
  return {
    Records: [
      {
        EventSource: "aws:sns",
        EventVersion: "1.0",
        EventSubscriptionArn: "arn:aws:sns:ap-northeast-1:123456789012:test-topic:sub",
        Sns: {
          Message: JSON.stringify(payload),
        } as never,
      },
    ],
  } as SNSEvent;
}

function mockFetchResponse(data: unknown) {
  return jest.spyOn(globalThis, "fetch").mockResolvedValue({
    json: async () => ({ data }),
  } as Response);
}

beforeEach(() => {
  ddbMock.reset();
  jest.restoreAllMocks();
});

test("expoPushTokenを持つユーザーのみ送信対象になり、Expo Push APIへ正しいtitle/bodyでPOSTする", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "user-1" } })
    .resolves({ Item: { expoPushToken: "ExponentPushToken[aaa]" } });
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "user-2" } }).resolves({ Item: {} });
  const fetchMock = mockFetchResponse([{ status: "ok", id: "ticket-1" }]);

  await handler(
    buildEvent({
      type: "chat_message",
      roomId: "room-1",
      senderName: "テスト送信者",
      bodyPreview: "こんにちは",
      targetUserIds: ["user-1", "user-2"],
    }),
    {} as never,
    (() => {}) as never,
  );

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe("https://exp.host/--/api/v2/push/send");
  const body = JSON.parse((options as RequestInit).body as string);
  expect(body).toEqual([
    { to: "ExponentPushToken[aaa]", title: "テスト送信者", body: "こんにちは", data: { type: "chat_message", roomId: "room-1" } },
  ]);
});

test("トークンを持つユーザーが0人の場合はExpo Push APIを呼ばない", async () => {
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "user-1" } }).resolves({ Item: {} });
  const fetchMock = mockFetchResponse([]);

  await handler(
    buildEvent({ type: "bulletin_post", postId: "post-1", title: "お知らせ", targetUserIds: ["user-1"] }),
    {} as never,
    (() => {}) as never,
  );

  expect(fetchMock).not.toHaveBeenCalled();
});

test("ticketがDeviceNotRegisteredの場合、該当ユーザーのexpoPushTokenを削除する", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "user-1" } })
    .resolves({ Item: { userId: "user-1", displayName: "テスト", expoPushToken: "ExponentPushToken[stale]" } });
  mockFetchResponse([{ status: "error", message: "no longer registered", details: { error: "DeviceNotRegistered" } }]);

  await handler(
    buildEvent({ type: "calendar_reminder", eventId: "event-1", title: "定例会議", targetUserIds: ["user-1"] }),
    {} as never,
    (() => {}) as never,
  );

  const putCalls = ddbMock.commandCalls(PutCommand);
  expect(putCalls).toHaveLength(1);
  expect(putCalls[0].args[0].input.Item).toEqual({ userId: "user-1", displayName: "テスト", expoPushToken: undefined });
});

test("ticketがok（正常配信）の場合はトークンを削除しない", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "user-1" } })
    .resolves({ Item: { userId: "user-1", expoPushToken: "ExponentPushToken[aaa]" } });
  mockFetchResponse([{ status: "ok", id: "ticket-1" }]);

  await handler(
    buildEvent({ type: "incoming_call", callId: "call-1", callerId: "caller-1", callerName: "呼び出し元", targetUserIds: ["user-1"] }),
    {} as never,
    (() => {}) as never,
  );

  expect(ddbMock.commandCalls(PutCommand)).toHaveLength(0);
});

test("未知のtypeは通知を組み立てず、Expo Push APIを呼ばない", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "user-1" } })
    .resolves({ Item: { expoPushToken: "ExponentPushToken[aaa]" } });
  const fetchMock = mockFetchResponse([]);

  await handler(buildEvent({ type: "unknown_type", targetUserIds: ["user-1"] }), {} as never, (() => {}) as never);

  expect(fetchMock).not.toHaveBeenCalled();
});
