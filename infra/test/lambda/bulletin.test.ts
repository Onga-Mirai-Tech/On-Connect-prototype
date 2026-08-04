process.env.BULLETIN_POSTS_TABLE_NAME = "test-BulletinPosts";
process.env.USERS_TABLE_NAME = "test-Users";

import { mockClient } from "aws-sdk-client-mock";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { BulletinPost, User } from "@on-connect/shared";
import { handler } from "../../lambda/bulletin/crud";

const ddbMock = mockClient(DynamoDBDocumentClient);

const caller: User = {
  userId: "caller-1",
  displayName: "田中",
  furigana: "たなか",
  email: "tanaka@example.com",
  roleId: "role-member",
  memberCategoryId: "cat-parttime",
  notificationStatus: "ON",
};

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/bulletin-posts",
    httpMethod: "GET",
    path: "/bulletin-posts",
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    headers: {},
    multiValueHeaders: {},
    body: null,
    isBase64Encoded: false,
    stageVariables: null,
    requestContext: { authorizer: { claims: { sub: "caller-1" } } } as never,
    ...overrides,
  } as APIGatewayProxyEvent;
}

async function invoke(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const result = await handler(event, {} as never, (() => {}) as never);
  return result as APIGatewayProxyResult;
}

beforeEach(() => {
  ddbMock.reset();
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: caller });
});

test("GET /bulletin-posts は閲覧権限のある投稿だけ返す", async () => {
  const visiblePost: BulletinPost = {
    postId: "p1",
    title: "全体公開のお知らせ",
    category: "お知らせ",
    body: "<p>本文</p>",
    authorId: "author-1",
    visibleCategoryIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  const restrictedVisible: BulletinPost = {
    ...visiblePost,
    postId: "p2",
    title: "パート向け",
    visibleCategoryIds: ["cat-parttime"],
    createdAt: "2026-08-02T00:00:00.000Z",
  };
  const restrictedHidden: BulletinPost = {
    ...visiblePost,
    postId: "p3",
    title: "正職員向け",
    visibleCategoryIds: ["cat-fulltime"],
    createdAt: "2026-08-03T00:00:00.000Z",
  };
  ddbMock
    .on(ScanCommand, { TableName: "test-BulletinPosts" })
    .resolves({ Items: [visiblePost, restrictedVisible, restrictedHidden] });

  const res = await invoke(buildEvent({ resource: "/bulletin-posts", httpMethod: "GET" }));

  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as BulletinPost[];
  expect(body.map((p) => p.postId)).toEqual(["p2", "p1"]); // createdAt降順、非公開(p3)は除外
});

test("GET /bulletin-posts/{postId} は閲覧権限がなければ403", async () => {
  const hiddenPost: BulletinPost = {
    postId: "p3",
    title: "正職員向け",
    category: "お知らせ",
    body: "<p>本文</p>",
    authorId: "author-1",
    visibleCategoryIds: ["cat-fulltime"],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
  };
  ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p3" } }).resolves({ Item: hiddenPost });

  const res = await invoke(
    buildEvent({ resource: "/bulletin-posts/{postId}", httpMethod: "GET", pathParameters: { postId: "p3" } }),
  );

  expect(res.statusCode).toBe(403);
});

test("POST /bulletin-posts で新規投稿を作成できる", async () => {
  ddbMock.on(PutCommand).resolves({});

  const res = await invoke(
    buildEvent({
      resource: "/bulletin-posts",
      httpMethod: "POST",
      body: JSON.stringify({ title: "運動会のお知らせ", category: "行事", body: "<p>10月開催</p>" }),
    }),
  );

  expect(res.statusCode).toBe(201);
  const body = JSON.parse(res.body) as BulletinPost;
  expect(body.title).toBe("運動会のお知らせ");
  expect(body.authorId).toBe("caller-1");
  expect(body.visibleCategoryIds).toEqual([]);
  expect(typeof body.postId).toBe("string");
});

test("POST /bulletin-posts はtitle不足で400", async () => {
  const res = await invoke(
    buildEvent({
      resource: "/bulletin-posts",
      httpMethod: "POST",
      body: JSON.stringify({ category: "行事", body: "<p>本文</p>" }),
    }),
  );

  expect(res.statusCode).toBe(400);
});

test("PUT /bulletin-posts/{postId} で更新しupdatedAtが更新される", async () => {
  const existing: BulletinPost = {
    postId: "p1",
    title: "旧タイトル",
    category: "お知らせ",
    body: "<p>旧本文</p>",
    authorId: "author-1",
    visibleCategoryIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({ Item: existing });
  ddbMock.on(PutCommand).resolves({});

  const res = await invoke(
    buildEvent({
      resource: "/bulletin-posts/{postId}",
      httpMethod: "PUT",
      pathParameters: { postId: "p1" },
      body: JSON.stringify({ title: "新タイトル" }),
    }),
  );

  expect(res.statusCode).toBe(200);
  const body = JSON.parse(res.body) as BulletinPost;
  expect(body.title).toBe("新タイトル");
  expect(body.updatedAt).not.toBe(existing.updatedAt);
});

test("DELETE /bulletin-posts/{postId} で削除できる", async () => {
  ddbMock
    .on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } })
    .resolves({ Item: { postId: "p1" } });
  ddbMock.on(DeleteCommand).resolves({});

  const res = await invoke(
    buildEvent({ resource: "/bulletin-posts/{postId}", httpMethod: "DELETE", pathParameters: { postId: "p1" } }),
  );

  expect(res.statusCode).toBe(204);
});
