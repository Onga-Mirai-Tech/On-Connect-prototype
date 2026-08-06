process.env.MESSAGES_TABLE_NAME = "test-Messages";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { AppSyncResolverEvent } from "aws-lambda";
import type { Message } from "@on-connect/shared";
import { handler } from "../../lambda/messages/toggleReaction";

const ddbMock = mockClient(DynamoDBDocumentClient);

interface ToggleReactionInput {
  roomId: string;
  messageId: string;
  emoji: string;
  userId: string;
}

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

function buildEvent(input: ToggleReactionInput): AppSyncResolverEvent<{ input: ToggleReactionInput }> {
  return {
    arguments: { input },
    source: null,
    request: { headers: {}, domainName: null },
    info: { selectionSetList: [], selectionSetGraphQL: "", parentTypeName: "Mutation", fieldName: "toggleMessageReaction", variables: {} },
    prev: null,
    stash: {},
  } as AppSyncResolverEvent<{ input: ToggleReactionInput }>;
}

beforeEach(() => {
  ddbMock.reset();
});

test("リアクションが無ければ新規追加する", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Messages", Key: { roomId: "room-1", messageId: "msg-1" } })
    .resolves({ Item: buildMessage() });
  ddbMock.on(UpdateCommand).resolves({});

  const result = await handler(
    buildEvent({ roomId: "room-1", messageId: "msg-1", emoji: "👍", userId: "u1" }),
    {} as never,
    (() => {}) as never,
  );

  expect(result?.reactions).toEqual([{ emoji: "👍", userIds: ["u1"] }]);
  const updateCall = ddbMock.commandCalls(UpdateCommand)[0];
  expect(updateCall.args[0].input.UpdateExpression).toBe("SET reactions = :reactions");
});

test("既に自分がリアクション済みなら取り消す（0人になったら要素ごと削除）", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Messages", Key: { roomId: "room-1", messageId: "msg-1" } })
    .resolves({ Item: buildMessage({ reactions: [{ emoji: "👍", userIds: ["u1"] }] }) });
  ddbMock.on(UpdateCommand).resolves({});

  const result = await handler(
    buildEvent({ roomId: "room-1", messageId: "msg-1", emoji: "👍", userId: "u1" }),
    {} as never,
    (() => {}) as never,
  );

  expect(result?.reactions).toEqual([]);
});

test("別の絵文字で他ユーザーが既にリアクションしていても、自分の分だけ追加される", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-Messages", Key: { roomId: "room-1", messageId: "msg-1" } })
    .resolves({ Item: buildMessage({ reactions: [{ emoji: "👍", userIds: ["other-user"] }] }) });
  ddbMock.on(UpdateCommand).resolves({});

  const result = await handler(
    buildEvent({ roomId: "room-1", messageId: "msg-1", emoji: "❤️", userId: "u1" }),
    {} as never,
    (() => {}) as never,
  );

  expect(result?.reactions).toEqual([
    { emoji: "👍", userIds: ["other-user"] },
    { emoji: "❤️", userIds: ["u1"] },
  ]);
});

test("メッセージが存在しない場合はエラーになる", async () => {
  ddbMock.on(GetCommand, { TableName: "test-Messages", Key: { roomId: "room-1", messageId: "missing" } }).resolves({});

  await expect(
    handler(buildEvent({ roomId: "room-1", messageId: "missing", emoji: "👍", userId: "u1" }), {} as never, (() => {}) as never),
  ).rejects.toThrow();
});
