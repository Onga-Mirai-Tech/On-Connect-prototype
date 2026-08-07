process.env.ATTACHMENTS_BUCKET_NAME = "test-Attachments";
process.env.CHAT_ROOMS_TABLE_NAME = "test-ChatRooms";
process.env.BULLETIN_POSTS_TABLE_NAME = "test-BulletinPosts";
process.env.USERS_TABLE_NAME = "test-Users";

import { mockClient } from "aws-sdk-client-mock";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { BulletinPost, ChatRoom } from "@on-connect/shared";

// getSignedUrlはS3Client.send()を呼ばずローカルでSigV4署名するだけなので、
// aws-sdk-client-mockのリクエスト横取りは効かない。関数自体を直接モックする。
const getSignedUrl = jest.fn().mockResolvedValue("https://example.com/fake-presigned-url");
jest.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrl(...args),
}));

import { handler } from "../../lambda/attachments/presign";

const ddbMock = mockClient(DynamoDBDocumentClient);

const room: ChatRoom = {
  roomId: "room-1",
  isGroup: false,
  memberUserIds: ["caller-1", "other-user"],
  createdAt: "2026-08-01T00:00:00.000Z",
};

const visiblePost: BulletinPost = {
  postId: "post-1",
  title: "全体公開",
  body: "<p>本文</p>",
  authorId: "author-1",
  visibleCategoryIds: [],
  attachments: [{ key: "bulletin/post-1/abc-flyer.pdf", fileName: "flyer.pdf", contentType: "application/pdf", size: 100 }],
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

const restrictedPost: BulletinPost = {
  ...visiblePost,
  postId: "post-2",
  visibleCategoryIds: ["cat-fulltime"],
  attachments: [{ key: "bulletin/post-2/abc-flyer.pdf", fileName: "flyer.pdf", contentType: "application/pdf", size: 100 }],
};

function buildEvent(overrides: Partial<APIGatewayProxyEvent>): APIGatewayProxyEvent {
  return {
    resource: "/attachments/upload-url",
    httpMethod: "POST",
    path: "/attachments/upload-url",
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
  getSignedUrl.mockClear();
  getSignedUrl.mockResolvedValue("https://example.com/fake-presigned-url");
  ddbMock.on(GetCommand, { TableName: "test-ChatRooms", Key: { roomId: "room-1" } }).resolves({ Item: room });
  ddbMock.on(GetCommand, { TableName: "test-ChatRooms", Key: { roomId: "room-missing" } }).resolves({});
  ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "post-1" } }).resolves({ Item: visiblePost });
  ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "post-2" } }).resolves({ Item: restrictedPost });
  ddbMock.on(GetCommand, { TableName: "test-BulletinPosts", Key: { postId: "post-missing" } }).resolves({});
  ddbMock
    .on(GetCommand, { TableName: "test-Users", Key: { userId: "caller-1" } })
    .resolves({ Item: { userId: "caller-1", memberCategoryId: "cat-parttime" } });
});

describe("POST /attachments/upload-url", () => {
  test("chatコンテキスト：ルームメンバーなら200でattachmentとuploadUrlを返す", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "chat",
          ownerId: "room-1",
          fileName: "photo.png",
          contentType: "image/png",
          size: 1000,
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { uploadUrl: string; attachment: { key: string } };
    expect(body.uploadUrl).toBe("https://example.com/fake-presigned-url");
    expect(body.attachment.key).toMatch(/^chat\/room-1\/[^/]+-photo\.png$/);

    const call = getSignedUrl.mock.calls[0];
    const command = call[1] as PutObjectCommand;
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input.Bucket).toBe("test-Attachments");
    expect(command.input.ContentType).toBe("image/png");
    expect(command.input.ContentLength).toBe(1000);
  });

  test("chatコンテキスト：ルームメンバーでなければ403", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "chat",
          ownerId: "room-1",
          fileName: "photo.png",
          contentType: "image/png",
          size: 1000,
        }),
        requestContext: { authorizer: { claims: { sub: "not-a-member" } } } as never,
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("chatコンテキスト：ルームが存在しなければ404", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "chat",
          ownerId: "room-missing",
          fileName: "photo.png",
          contentType: "image/png",
          size: 1000,
        }),
      }),
    );

    expect(res.statusCode).toBe(404);
  });

  test("bulletinコンテキスト：投稿の閲覧権限に関わらず認証済みなら200（投稿本体に権限チェックが無い既存方針と同じ）", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "bulletin",
          ownerId: "draft-123",
          fileName: "flyer.pdf",
          contentType: "application/pdf",
          size: 2000,
        }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { attachment: { key: string } };
    expect(body.attachment.key).toMatch(/^bulletin\/draft-123\/[^/]+-flyer\.pdf$/);
  });

  test("許可されていないcontentTypeは400", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "bulletin",
          ownerId: "draft-123",
          fileName: "virus.exe",
          contentType: "application/x-msdownload",
          size: 1000,
        }),
      }),
    );

    expect(res.statusCode).toBe(400);
  });

  test("サイズ上限超過は400", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "bulletin",
          ownerId: "draft-123",
          fileName: "big.png",
          contentType: "image/png",
          size: 100 * 1024 * 1024,
        }),
      }),
    );

    expect(res.statusCode).toBe(400);
  });

  test("contextが不正な値なら400", async () => {
    const res = await invoke(
      buildEvent({
        body: JSON.stringify({
          context: "invalid",
          ownerId: "room-1",
          fileName: "photo.png",
          contentType: "image/png",
          size: 1000,
        }),
      }),
    );

    expect(res.statusCode).toBe(400);
  });
});

describe("POST /attachments/download-url", () => {
  function downloadEvent(overrides: Partial<APIGatewayProxyEvent> = {}): APIGatewayProxyEvent {
    return buildEvent({ resource: "/attachments/download-url", path: "/attachments/download-url", ...overrides });
  }

  test("chatコンテキスト：ルームメンバーなら200", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "chat", ownerId: "room-1", key: "chat/room-1/abc-photo.png" }),
      }),
    );

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body) as { downloadUrl: string; expiresInSeconds: number };
    expect(body.downloadUrl).toBe("https://example.com/fake-presigned-url");
    expect(body.expiresInSeconds).toBe(900);

    const call = getSignedUrl.mock.calls[0];
    const command = call[1] as GetObjectCommand;
    expect(command).toBeInstanceOf(GetObjectCommand);
    expect(command.input.Key).toBe("chat/room-1/abc-photo.png");
  });

  test("chatコンテキスト：ルームメンバーでなければ403", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "chat", ownerId: "room-1", key: "chat/room-1/abc-photo.png" }),
        requestContext: { authorizer: { claims: { sub: "not-a-member" } } } as never,
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("chatコンテキスト：ルームが存在しなければ404", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "chat", ownerId: "room-missing", key: "chat/room-missing/abc-photo.png" }),
      }),
    );

    expect(res.statusCode).toBe(404);
  });

  test("bulletinコンテキスト：閲覧可能な投稿なら200", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "bulletin", ownerId: "post-1", key: "bulletin/post-1/abc-flyer.pdf" }),
      }),
    );

    expect(res.statusCode).toBe(200);
  });

  test("bulletinコンテキスト：閲覧権限が無ければ403", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "bulletin", ownerId: "post-2", key: "bulletin/post-2/abc-flyer.pdf" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("bulletinコンテキスト：投稿が存在しなければ404", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "bulletin", ownerId: "post-missing", key: "bulletin/post-missing/abc.pdf" }),
      }),
    );

    expect(res.statusCode).toBe(404);
  });

  test("chatコンテキスト：keyがownerId(roomId)のprefixと一致しなければ403", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "chat", ownerId: "room-1", key: "chat/other-room/abc-photo.png" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });

  test("bulletinコンテキスト：keyが投稿のattachments一覧に含まれていなければ403（新規投稿時のdraft ID使用によりpostIdとS3キーのprefixが一致しないため、prefix一致ではなく投稿のattachments一覧との照合で認可する）", async () => {
    const res = await invoke(
      downloadEvent({
        body: JSON.stringify({ context: "bulletin", ownerId: "post-1", key: "bulletin/draft-xyz/other-file.pdf" }),
      }),
    );

    expect(res.statusCode).toBe(403);
  });
});
