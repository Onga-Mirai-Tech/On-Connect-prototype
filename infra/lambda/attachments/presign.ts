import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { BulletinPost } from "@on-connect/shared";
// バレル(@on-connect/shared)ではなくattachments.tsを直接importする
// （Phase 6の@holiday-jp/holiday_jpバンドル肥大化の教訓、calendar/crud.tsのics.ts importと同じパターン）
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  buildAttachmentKey,
  isAllowedAttachmentType,
  type AttachmentContext,
  type AttachmentRef,
} from "@on-connect/shared/src/attachments";
import { docClient } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
} from "../common/http";
import { fetchChatRoom, isChatRoomMember, isVisibleToCategory } from "../common/visibility";

const ATTACHMENTS_BUCKET_NAME = process.env.ATTACHMENTS_BUCKET_NAME!;
const CHAT_ROOMS_TABLE_NAME = process.env.CHAT_ROOMS_TABLE_NAME!;
const BULLETIN_POSTS_TABLE_NAME = process.env.BULLETIN_POSTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

const UPLOAD_URL_EXPIRES_SECONDS = 300; // 5分
const DOWNLOAD_URL_EXPIRES_SECONDS = 900; // 15分

const s3Client = new S3Client({});

/**
 * チャット・掲示板の添付ファイル用、S3署名付きURL発行（Phase 12、設計書5.2.1 / 5.3.2）。
 * CloudFrontのKey Group／秘密鍵運用は使わず、クライアントはS3の署名付きURLへ直接PUT/GETする方式
 * （前セッションで指摘された「CloudFront署名付きURL未実装」への対応として、この方式を採用）。
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/attachments/upload-url" && httpMethod === "POST") return issueUploadUrl(event);
    if (resource === "/attachments/download-url" && httpMethod === "POST") return issueDownloadUrl(event);

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

interface UploadUrlRequest {
  context?: AttachmentContext;
  ownerId?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
}

async function issueUploadUrl(event: APIGatewayProxyEvent) {
  const userId = getCurrentUserId(event);
  const { context, ownerId, fileName, contentType, size } = parseJsonBody<UploadUrlRequest>(event);

  if (context !== "chat" && context !== "bulletin") {
    throw new HttpError(400, "context は chat または bulletin を指定してください");
  }
  if (!ownerId) throw new HttpError(400, "ownerId は必須です");
  if (!fileName) throw new HttpError(400, "fileName は必須です");
  if (!contentType || !isAllowedAttachmentType(contentType)) {
    throw new HttpError(400, "許可されていないファイル形式です");
  }
  if (!size || size <= 0 || size > ATTACHMENT_MAX_SIZE_BYTES) {
    throw new HttpError(400, `ファイルサイズは${ATTACHMENT_MAX_SIZE_BYTES}バイト以下にしてください`);
  }

  if (context === "chat") {
    await requireChatRoomMember(ownerId, userId);
  }
  // bulletinは投稿本体に権限チェックが無い既存方針（createPost/updatePostと同じ）に合わせ、
  // アップロードは認証済みユーザーであれば誰でも可能とする（新規作成時はpostIdがまだ無く、
  // クライアントが生成したdraft IDをownerIdとして使うため、そもそも投稿の実体と紐付かない）

  const attachmentId = randomUUID();
  const key = buildAttachmentKey(context, ownerId, attachmentId, fileName);

  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: ATTACHMENTS_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_SECONDS },
  );

  const attachment: AttachmentRef = { key, fileName, contentType, size };
  return jsonResponse(200, { uploadUrl, attachment });
}

interface DownloadUrlRequest {
  context?: AttachmentContext;
  ownerId?: string;
  key?: string;
}

async function issueDownloadUrl(event: APIGatewayProxyEvent) {
  const userId = getCurrentUserId(event);
  const { context, ownerId, key } = parseJsonBody<DownloadUrlRequest>(event);

  if (context !== "chat" && context !== "bulletin") {
    throw new HttpError(400, "context は chat または bulletin を指定してください");
  }
  if (!ownerId) throw new HttpError(400, "ownerId は必須です");
  if (!key) throw new HttpError(400, "key は必須です");

  if (context === "chat") {
    // チャットは常にownerId=roomIdでアップロードされる（掲示板と異なりpostId確定待ちの
    // draft IDパターンが無いため）ので、prefix一致は素直な検証として使える
    if (!key.startsWith(`chat/${ownerId}/`)) {
      throw new HttpError(403, "このキーにアクセスする権限がありません");
    }
    await requireChatRoomMember(ownerId, userId);
  } else {
    // 掲示板の新規投稿は投稿保存前（postId未確定）にdraft IDでアップロードするため、
    // 保存後の実postIdとS3キーのprefixが一致しない。prefix一致では判定できないため、
    // 実際に投稿のattachments一覧にそのキーが含まれるかで認可する
    await requireBulletinAttachmentAccess(ownerId, key, userId);
  }

  const downloadUrl = await getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: ATTACHMENTS_BUCKET_NAME, Key: key }),
    { expiresIn: DOWNLOAD_URL_EXPIRES_SECONDS },
  );

  return jsonResponse(200, { downloadUrl, expiresInSeconds: DOWNLOAD_URL_EXPIRES_SECONDS });
}

async function requireChatRoomMember(roomId: string, userId: string): Promise<void> {
  const room = await fetchChatRoom(CHAT_ROOMS_TABLE_NAME, roomId);
  if (!room) throw new HttpError(404, "チャットルームが見つかりません");
  if (!isChatRoomMember(room, userId)) throw new HttpError(403, "このルームのメンバーではありません");
}

async function requireBulletinAttachmentAccess(postId: string, key: string, userId: string): Promise<void> {
  const result = await docClient.send(new GetCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Key: { postId } }));
  const post = result.Item as BulletinPost | undefined;
  if (!post) throw new HttpError(404, "投稿が見つかりません");
  if (!post.attachments?.some((a) => a.key === key)) {
    throw new HttpError(403, "このキーにアクセスする権限がありません");
  }

  const userResult = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  const user = userResult.Item as { memberCategoryId: string } | undefined;
  if (!user) throw new HttpError(403, "ユーザー情報が見つかりません");

  if (!isVisibleToCategory(post.visibleCategoryIds, user.memberCategoryId)) {
    throw new HttpError(403, "この投稿を閲覧する権限がありません");
  }
}
