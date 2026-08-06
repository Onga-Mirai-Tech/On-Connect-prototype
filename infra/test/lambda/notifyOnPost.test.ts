process.env.USERS_TABLE_NAME = "test-Users";
process.env.PUSH_TOPIC_ARN = "arn:aws:sns:ap-northeast-1:123456789012:test-topic";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import { marshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamEvent } from "aws-lambda";
import type { BulletinPost, User } from "@on-connect/shared";
import { handler } from "../../lambda/bulletin/notifyOnPost";

const ddbMock = mockClient(DynamoDBDocumentClient);
const snsMock = mockClient(SNSClient);

function buildPost(overrides: Partial<BulletinPost> = {}): BulletinPost {
  return {
    postId: "p1",
    title: "運動会のお知らせ",
    body: "<p>本文</p>",
    authorId: "author-1",
    visibleCategoryIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

function insertEvent(post: BulletinPost): DynamoDBStreamEvent {
  return {
    Records: [{ eventName: "INSERT", dynamodb: { NewImage: marshall(post, { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;
}

function modifyEvent(oldPost: BulletinPost, newPost: BulletinPost): DynamoDBStreamEvent {
  return {
    Records: [
      {
        eventName: "MODIFY",
        dynamodb: {
          OldImage: marshall(oldPost, { removeUndefinedValues: true }) as never,
          NewImage: marshall(newPost, { removeUndefinedValues: true }) as never,
        },
      },
    ],
  } as DynamoDBStreamEvent;
}

function mockUsers(users: Pick<User, "userId" | "memberCategoryId" | "notificationStatus">[]) {
  ddbMock.on(ScanCommand, { TableName: "test-Users" }).resolves({ Items: users });
}

beforeEach(() => {
  ddbMock.reset();
  snsMock.reset();
});

test("新規投稿（INSERT）は、閲覧可能かつ通知ONのユーザーに通知する", async () => {
  mockUsers([
    { userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" },
    { userId: "u2", memberCategoryId: "cat-a", notificationStatus: "OFF" },
  ]);

  await handler(insertEvent(buildPost()), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.type).toBe("bulletin_post");
  expect(payload.postId).toBe("p1");
  expect(payload.targetUserIds).toEqual(["u1"]);
});

test("visibleCategoryIdsで閲覧範囲が限定されている場合、対象カテゴリー以外には通知しない", async () => {
  mockUsers([
    { userId: "u1", memberCategoryId: "cat-fulltime", notificationStatus: "ON" },
    { userId: "u2", memberCategoryId: "cat-parttime", notificationStatus: "ON" },
  ]);

  await handler(insertEvent(buildPost({ visibleCategoryIds: ["cat-fulltime"] })), {} as never, (() => {}) as never);

  const payload = JSON.parse(snsMock.commandCalls(PublishCommand)[0].args[0].input.Message as string);
  expect(payload.targetUserIds).toEqual(["u1"]);
});

test("本文が更新されたMODIFY（updatedAtが変わっている）は通知する", async () => {
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" }]);
  const oldPost = buildPost();
  const newPost = buildPost({ title: "運動会のお知らせ（更新）", updatedAt: "2026-08-02T00:00:00.000Z" });

  await handler(modifyEvent(oldPost, newPost), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
});

test("リアクションのみの更新（updatedAtが変わらないMODIFY）は通知しない", async () => {
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" }]);
  const oldPost = buildPost({ reactions: [] });
  const newPost = buildPost({ reactions: [{ emoji: "👍", userIds: ["u1"] }] }); // updatedAtは同じ

  await handler(modifyEvent(oldPost, newPost), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});

test("対象ユーザーが0人ならSNSにpublishしない", async () => {
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "OFF" }]);

  await handler(insertEvent(buildPost()), {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});

test("INSERT/MODIFY以外のイベント（REMOVE等）は無視する", async () => {
  mockUsers([{ userId: "u1", memberCategoryId: "cat-a", notificationStatus: "ON" }]);
  const event: DynamoDBStreamEvent = {
    Records: [{ eventName: "REMOVE", dynamodb: { OldImage: marshall(buildPost(), { removeUndefinedValues: true }) as never } }],
  } as DynamoDBStreamEvent;

  await handler(event, {} as never, (() => {}) as never);

  expect(snsMock.commandCalls(PublishCommand)).toHaveLength(0);
});
