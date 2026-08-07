process.env.BULLETIN_POSTS_TABLE_NAME = "test-BulletinPosts";
process.env.BULLETIN_CATEGORIES_TABLE_NAME = "test-BulletinCategories";
process.env.BULLETIN_COMMENTS_TABLE_NAME = "test-BulletinComments";
process.env.USERS_TABLE_NAME = "test-Users";
process.env.ATTACHMENTS_BUCKET_NAME = "test-Attachments";

import { mockClient } from "aws-sdk-client-mock";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { AttachmentRef, BulletinCategory, BulletinComment, BulletinPost, RolePermissions, User } from "@on-connect/shared";
import { handler } from "../../lambda/bulletin/crud";

const ddbMock = mockClient(DynamoDBDocumentClient);
const s3Mock = mockClient(S3Client);

const noPermissions: RolePermissions = {
  manageUsers: false,
  sendForceNotify: false,
  manageBulletinCategories: false,
  manageOrgLinks: false,
  manageRoles: false,
  manageMemberCategories: false,
  manageCalendarCategories: false,
  manageShifts: false,
};

const bulletinCategoryAdminPermissions: RolePermissions = { ...noPermissions, manageBulletinCategories: true };

const caller: User = {
  userId: "caller-1",
  loginId: "staff-caller-1",
  displayName: "田中",
  furigana: "たなか",
  email: "tanaka@example.com",
  roleId: "role-member",
  memberCategoryId: "cat-parttime",
  notificationStatus: "ON",
  permissions: noPermissions,
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
  s3Mock.reset();
  ddbMock.on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } }).resolves({ Item: caller });
  s3Mock.on(DeleteObjectsCommand).resolves({});
});

describe("BulletinPosts CRUD", () => {
  test("GET /bulletin-posts は閲覧権限のある投稿だけ返す", async () => {
    const visiblePost: BulletinPost = {
      postId: "p1",
      title: "全体公開のお知らせ",
      categoryId: "bc-announcement",
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
      categoryId: "bc-announcement",
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
        body: JSON.stringify({ title: "運動会のお知らせ", categoryId: "bc-event", body: "<p>10月開催</p>" }),
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
        body: JSON.stringify({ categoryId: "bc-event", body: "<p>本文</p>" }),
      }),
    );

    expect(res.statusCode).toBe(400);
  });

  test("PUT /bulletin-posts/{postId} で更新しupdatedAtが更新される", async () => {
    const existing: BulletinPost = {
      postId: "p1",
      title: "旧タイトル",
      categoryId: "bc-announcement",
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

  test("DELETE /bulletin-posts/{postId} で削除できる（作成者以外でも可）", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } })
      .resolves({ Item: { postId: "p1", authorId: "someone-else" } });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/bulletin-posts/{postId}", httpMethod: "DELETE", pathParameters: { postId: "p1" } }),
    );

    expect(res.statusCode).toBe(204);
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  // --- 添付ファイルのS3クリーンアップ（Phase 12） ---

  const attachmentA: AttachmentRef = { key: "bulletin/p1/a-1.png", fileName: "a.png", contentType: "image/png", size: 100 };
  const attachmentB: AttachmentRef = { key: "bulletin/p1/b-2.pdf", fileName: "b.pdf", contentType: "application/pdf", size: 200 };

  test("PUT /bulletin-posts/{postId} で添付が一部外れると、外れた分だけS3から削除される", async () => {
    const existing: BulletinPost = {
      postId: "p1",
      title: "旧タイトル",
      body: "<p>本文</p>",
      authorId: "author-1",
      visibleCategoryIds: [],
      attachments: [attachmentA, attachmentB],
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
        body: JSON.stringify({ attachments: [attachmentA] }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const calls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.Delete?.Objects).toEqual([{ Key: attachmentB.key }]);
  });

  test("PUT /bulletin-posts/{postId} でattachmentsを含まない更新はS3を呼ばない", async () => {
    const existing: BulletinPost = {
      postId: "p1",
      title: "旧タイトル",
      body: "<p>本文</p>",
      authorId: "author-1",
      visibleCategoryIds: [],
      attachments: [attachmentA],
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
    expect(s3Mock.commandCalls(DeleteObjectsCommand)).toHaveLength(0);
  });

  test("PUT /bulletin-posts/{postId} でattachments: []を指定すると全添付が削除される", async () => {
    const existing: BulletinPost = {
      postId: "p1",
      title: "旧タイトル",
      body: "<p>本文</p>",
      authorId: "author-1",
      visibleCategoryIds: [],
      attachments: [attachmentA, attachmentB],
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
        body: JSON.stringify({ attachments: [] }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const calls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.Delete?.Objects).toEqual(
      expect.arrayContaining([{ Key: attachmentA.key }, { Key: attachmentB.key }]),
    );
  });

  test("DELETE /bulletin-posts/{postId} は投稿が持つ全添付をS3から削除する", async () => {
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({
      Item: { postId: "p1", authorId: "author-1", attachments: [attachmentA, attachmentB] },
    });
    ddbMock.on(DeleteCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/bulletin-posts/{postId}", httpMethod: "DELETE", pathParameters: { postId: "p1" } }),
    );

    expect(res.statusCode).toBe(204);
    const calls = s3Mock.commandCalls(DeleteObjectsCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[0].input.Delete?.Objects).toEqual(
      expect.arrayContaining([{ Key: attachmentA.key }, { Key: attachmentB.key }]),
    );
  });
});

describe("BulletinCategories CRUD", () => {
  test("GET /bulletin-categories は権限チェック無しで一覧を返す", async () => {
    const categories: BulletinCategory[] = [{ categoryId: "bc-1", name: "お知らせ" }];
    ddbMock.on(ScanCommand, { TableName: "test-BulletinCategories" }).resolves({ Items: categories });

    const res = await invoke(buildEvent({ resource: "/bulletin-categories", httpMethod: "GET" }));

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual(categories);
  });

  test("POST /bulletin-categories はテーブルが空なら権限チェック無しで作成できる（初期セットアップ）", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-BulletinCategories" }).resolves({ Items: [] });
    ddbMock.on(GetCommand, { TableName: "test-BulletinCategories" }).resolves({});
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({ resource: "/bulletin-categories", httpMethod: "POST", body: JSON.stringify({ name: "お知らせ" }) }),
    );

    expect(res.statusCode).toBe(201);
    expect(JSON.parse(res.body).name).toBe("お知らせ");
  });

  test("POST /bulletin-categories はテーブルが空でなければmanageBulletinCategories権限が無いと403", async () => {
    ddbMock.on(ScanCommand, { TableName: "test-BulletinCategories" }).resolves({ Items: [{ categoryId: "bc-1" }] });

    const res = await invoke(
      buildEvent({ resource: "/bulletin-categories", httpMethod: "POST", body: JSON.stringify({ name: "行事" }) }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("PUT /bulletin-categories/{categoryId} はmanageBulletinCategories権限があれば更新できる", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
      .resolves({ Item: { ...caller, permissions: bulletinCategoryAdminPermissions } });
    ddbMock
      .on(GetCommand, { TableName: "test-BulletinCategories", Key: { categoryId: "bc-1" } })
      .resolves({ Item: { categoryId: "bc-1", name: "お知らせ" } });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-categories/{categoryId}",
        httpMethod: "PUT",
        pathParameters: { categoryId: "bc-1" },
        body: JSON.stringify({ name: "お知らせ（更新）" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).name).toBe("お知らせ（更新）");
  });

  test("DELETE /bulletin-categories/{categoryId} は投稿に使用中の場合409", async () => {
    ddbMock
      .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
      .resolves({ Item: { ...caller, permissions: bulletinCategoryAdminPermissions } });
    ddbMock
      .on(GetCommand, { TableName: "test-BulletinCategories", Key: { categoryId: "bc-1" } })
      .resolves({ Item: { categoryId: "bc-1", name: "お知らせ" } });
    ddbMock
      .on(ScanCommand, { TableName: "test-BulletinPosts", FilterExpression: "categoryId = :categoryId" })
      .resolves({ Items: [{ postId: "p1" }] });

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-categories/{categoryId}",
        httpMethod: "DELETE",
        pathParameters: { categoryId: "bc-1" },
      }),
    );

    expect(res.statusCode).toBe(409);
  });
});

describe("BulletinComments（Phase 9）", () => {
  const visiblePost: BulletinPost = {
    postId: "p1",
    title: "全体公開のお知らせ",
    body: "<p>本文</p>",
    authorId: "author-1",
    visibleCategoryIds: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
  };
  const hiddenPost: BulletinPost = { ...visiblePost, postId: "p3", visibleCategoryIds: ["cat-fulltime"] };

  test("GET /bulletin-posts/{postId}/comments は閲覧権限が無ければ403", async () => {
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p3" } }).resolves({ Item: hiddenPost });

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/comments",
        httpMethod: "GET",
        pathParameters: { postId: "p3" },
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("GET /bulletin-posts/{postId}/comments は作成日時の昇順で返す", async () => {
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({ Item: visiblePost });
    ddbMock.on(QueryCommand, { TableName: "test-BulletinComments" }).resolves({
      Items: [
        { commentId: "c2", postId: "p1", authorId: "u2", body: "2番目", createdAt: "2026-08-02T00:00:00.000Z" },
        { commentId: "c1", postId: "p1", authorId: "u1", body: "1番目", createdAt: "2026-08-01T00:00:00.000Z" },
      ],
    });

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/comments",
        httpMethod: "GET",
        pathParameters: { postId: "p1" },
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as BulletinComment[];
    expect(body.map((c) => c.commentId)).toEqual(["c1", "c2"]);
  });

  test("POST /bulletin-posts/{postId}/comments でコメントを作成できる", async () => {
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({ Item: visiblePost });
    ddbMock.on(PutCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/comments",
        httpMethod: "POST",
        pathParameters: { postId: "p1" },
        body: JSON.stringify({ body: "コメント本文" }),
      }),
    );

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as BulletinComment;
    expect(body.body).toBe("コメント本文");
    expect(body.authorId).toBe("caller-1");
    expect(body.postId).toBe("p1");
    expect(typeof body.commentId).toBe("string");
  });

  test("POST /bulletin-posts/{postId}/comments はbody不足で400", async () => {
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({ Item: visiblePost });

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/comments",
        httpMethod: "POST",
        pathParameters: { postId: "p1" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.statusCode).toBe(400);
  });
});

describe("BulletinPost reactions（Phase 9）", () => {
  test("PUT /bulletin-posts/{postId}/reactions でリアクションをトグルできる（updatedAtは変更しない）", async () => {
    const post: BulletinPost = {
      postId: "p1",
      title: "全体公開のお知らせ",
      body: "<p>本文</p>",
      authorId: "author-1",
      visibleCategoryIds: [],
      reactions: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p1" } }).resolves({ Item: post });
    ddbMock.on(UpdateCommand).resolves({});

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/reactions",
        httpMethod: "PUT",
        pathParameters: { postId: "p1" },
        body: JSON.stringify({ emoji: "👍" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as BulletinPost;
    expect(body.reactions).toEqual([{ emoji: "👍", userIds: ["caller-1"] }]);
    expect(body.updatedAt).toBe(post.updatedAt);

    const updateCalls = ddbMock.commandCalls(UpdateCommand);
    expect(updateCalls[0].args[0].input.UpdateExpression).toBe("SET reactions = :reactions");
  });

  test("PUT /bulletin-posts/{postId}/reactions は閲覧権限が無ければ403", async () => {
    const hiddenPost: BulletinPost = {
      postId: "p3",
      title: "正職員向け",
      body: "<p>本文</p>",
      authorId: "author-1",
      visibleCategoryIds: ["cat-fulltime"],
      createdAt: "2026-08-03T00:00:00.000Z",
      updatedAt: "2026-08-03T00:00:00.000Z",
    };
    ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "p3" } }).resolves({ Item: hiddenPost });

    const res = await invoke(
      buildEvent({
        resource: "/bulletin-posts/{postId}/reactions",
        httpMethod: "PUT",
        pathParameters: { postId: "p3" },
        body: JSON.stringify({ emoji: "👍" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });
});
