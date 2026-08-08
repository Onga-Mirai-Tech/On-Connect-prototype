import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import type { AttachmentRef, BulletinCategory, BulletinComment, BulletinPost, User } from "@on-connect/shared";
import { toggleReaction } from "@on-connect/shared/src/mockData";
import { requirePermission } from "../common/authz";
import { docClient, isTableEmpty } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
  requireParam,
} from "../common/http";
import { isVisibleToCategory } from "../common/visibility";

const BULLETIN_POSTS_TABLE_NAME = process.env.BULLETIN_POSTS_TABLE_NAME!;
const BULLETIN_CATEGORIES_TABLE_NAME = process.env.BULLETIN_CATEGORIES_TABLE_NAME!;
const BULLETIN_COMMENTS_TABLE_NAME = process.env.BULLETIN_COMMENTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const ATTACHMENTS_BUCKET_NAME = process.env.ATTACHMENTS_BUCKET_NAME!;

const s3Client = new S3Client({});

/**
 * 掲示板添付は手動削除しない限り保持し続ける方針（チャット添付のような自動期限切れは無い）ため、
 * 添付が投稿の編集・削除で実際に外れた時点でS3側も明示的に削除する（Phase 12）。
 */
async function deleteAttachmentObjects(attachments: AttachmentRef[]): Promise<void> {
  if (attachments.length === 0) return; // S3のDeleteObjectsは空のObjects配列を拒否する
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: ATTACHMENTS_BUCKET_NAME,
      Delete: { Objects: attachments.map((a) => ({ Key: a.key })) },
    }),
  );
}

/**
 * 掲示板CRUD（設計書5.3.1〜5.3.3）。
 * 通知送信自体はBulletinPostsテーブルのStreamsをトリガーに notifyOnPost.ts が処理する。
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/bulletin-posts") {
      if (httpMethod === "GET") return listPosts(event);
      if (httpMethod === "POST") return createPost(event);
    }
    if (resource === "/bulletin-posts/{postId}") {
      const postId = requireParam(event, "postId");
      if (httpMethod === "GET") return getPost(postId, event);
      if (httpMethod === "PUT") return updatePost(postId, event);
      if (httpMethod === "DELETE") return deletePost(postId);
    }
    if (resource === "/bulletin-posts/{postId}/comments") {
      const postId = requireParam(event, "postId");
      if (httpMethod === "GET") return listComments(postId, event);
      if (httpMethod === "POST") return createComment(postId, event);
    }
    if (resource === "/bulletin-posts/{postId}/reactions") {
      const postId = requireParam(event, "postId");
      if (httpMethod === "PUT") return toggleBulletinReaction(postId, event);
    }
    if (resource === "/bulletin-categories") {
      if (httpMethod === "GET") return listCategories();
      if (httpMethod === "POST") return createCategory(event);
    }
    if (resource === "/bulletin-categories/{categoryId}") {
      const categoryId = requireParam(event, "categoryId");
      if (httpMethod === "PUT") return updateCategory(categoryId, event);
      if (httpMethod === "DELETE") return deleteCategory(categoryId, event);
    }

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

// ---------------------------------------------------------------------------
// BulletinPosts
// ---------------------------------------------------------------------------

async function listPosts(event: APIGatewayProxyEvent) {
  const memberCategoryId = await currentUserMemberCategoryId(event);
  const result = await docClient.send(new ScanCommand({ TableName: BULLETIN_POSTS_TABLE_NAME }));
  const posts = (result.Items as BulletinPost[] | undefined) ?? [];
  const visible = posts
    .filter((post) => isVisibleToCategory(post.visibleCategoryIds, memberCategoryId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return jsonResponse(200, visible);
}

async function getPost(postId: string, event: APIGatewayProxyEvent) {
  const post = await fetchPost(postId);
  if (!post) throw new HttpError(404, "投稿が見つかりません");

  const memberCategoryId = await currentUserMemberCategoryId(event);
  if (!isVisibleToCategory(post.visibleCategoryIds, memberCategoryId)) {
    throw new HttpError(403, "この投稿を閲覧する権限がありません");
  }
  return jsonResponse(200, post);
}

async function createPost(event: APIGatewayProxyEvent) {
  const authorId = getCurrentUserId(event);
  const input = parseJsonBody<Pick<BulletinPost, "title" | "body"> & Partial<BulletinPost>>(event);
  if (!input.title) throw new HttpError(400, "title は必須です");
  if (!input.body) throw new HttpError(400, "body は必須です");

  const now = new Date().toISOString();
  const post: BulletinPost = {
    postId: randomUUID(),
    title: input.title,
    body: input.body,
    authorId,
    visibleCategoryIds: input.visibleCategoryIds ?? [],
    ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    ...(input.attachments ? { attachments: input.attachments } : {}),
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Item: post }));
  return jsonResponse(201, post);
}

async function updatePost(postId: string, event: APIGatewayProxyEvent) {
  const input = parseJsonBody<Partial<BulletinPost>>(event);
  const current = await fetchPost(postId);
  if (!current) throw new HttpError(404, "投稿が見つかりません");

  const updated: BulletinPost = {
    ...current,
    ...input,
    postId,
    updatedAt: new Date().toISOString(),
  };

  // 添付が明示的に含まれるリクエスト（空配列での全クリアも含む）の場合のみ、
  // 外れた添付をS3から削除する（DB更新の前に行い、削除失敗時はDB更新自体も行わない）
  if (input.attachments) {
    const currentKeys = new Set((current.attachments ?? []).map((a) => a.key));
    const updatedKeys = new Set(updated.attachments?.map((a) => a.key) ?? []);
    const removed = (current.attachments ?? []).filter((a) => !updatedKeys.has(a.key) && currentKeys.has(a.key));
    await deleteAttachmentObjects(removed);
  }

  await docClient.send(new PutCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deletePost(postId: string) {
  const current = await fetchPost(postId);
  if (!current) throw new HttpError(404, "投稿が見つかりません");

  await deleteAttachmentObjects(current.attachments ?? []);
  await docClient.send(new DeleteCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Key: { postId } }));
  return jsonResponse(204, {});
}

async function fetchPost(postId: string): Promise<BulletinPost | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Key: { postId } }));
  return result.Item as BulletinPost | undefined;
}

/** 投稿の閲覧権限が無ければ403にする（コメント一覧・投稿・リアクションで共通利用） */
async function requirePostVisible(post: BulletinPost, event: APIGatewayProxyEvent): Promise<void> {
  const memberCategoryId = await currentUserMemberCategoryId(event);
  if (!isVisibleToCategory(post.visibleCategoryIds, memberCategoryId)) {
    throw new HttpError(403, "この投稿を閲覧する権限がありません");
  }
}

// ---------------------------------------------------------------------------
// BulletinComments（Phase 9、削除・編集は未対応。投稿の閲覧権限=isVisibleToCategoryで保護）
// ---------------------------------------------------------------------------

async function listComments(postId: string, event: APIGatewayProxyEvent) {
  const post = await fetchPost(postId);
  if (!post) throw new HttpError(404, "投稿が見つかりません");
  await requirePostVisible(post, event);

  const result = await docClient.send(
    new QueryCommand({
      TableName: BULLETIN_COMMENTS_TABLE_NAME,
      KeyConditionExpression: "postId = :postId",
      ExpressionAttributeValues: { ":postId": postId },
    }),
  );
  const comments = ((result.Items as BulletinComment[] | undefined) ?? []).sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  );
  return jsonResponse(200, comments);
}

async function createComment(postId: string, event: APIGatewayProxyEvent) {
  const authorId = getCurrentUserId(event);
  const post = await fetchPost(postId);
  if (!post) throw new HttpError(404, "投稿が見つかりません");
  await requirePostVisible(post, event);

  const input = parseJsonBody<{ body?: string }>(event);
  if (!input.body) throw new HttpError(400, "body は必須です");

  const comment: BulletinComment = {
    commentId: randomUUID(),
    postId,
    authorId,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  await docClient.send(new PutCommand({ TableName: BULLETIN_COMMENTS_TABLE_NAME, Item: comment }));
  return jsonResponse(201, comment);
}

// ---------------------------------------------------------------------------
// BulletinPostのリアクション（Phase 9）
// ---------------------------------------------------------------------------

/**
 * reactions属性だけを更新し、updatedAtには触れない。
 * updatedAtまで更新すると、リアクションを押すたびに notifyOnPost.ts が「投稿が更新された」と
 * みなして全閲覧対象者に通知を送ってしまうため、意図的にPUT /bulletin-posts/{postId}とは
 * 別の更新経路にしている。
 */
async function toggleBulletinReaction(postId: string, event: APIGatewayProxyEvent) {
  const userId = getCurrentUserId(event);
  const post = await fetchPost(postId);
  if (!post) throw new HttpError(404, "投稿が見つかりません");
  await requirePostVisible(post, event);

  const input = parseJsonBody<{ emoji?: string }>(event);
  if (!input.emoji) throw new HttpError(400, "emoji は必須です");

  const reactions = toggleReaction(post.reactions, input.emoji, userId);
  await docClient.send(
    new UpdateCommand({
      TableName: BULLETIN_POSTS_TABLE_NAME,
      Key: { postId },
      UpdateExpression: "SET reactions = :reactions",
      ExpressionAttributeValues: { ":reactions": reactions },
    }),
  );
  return jsonResponse(200, { ...post, reactions });
}

async function currentUserMemberCategoryId(event: APIGatewayProxyEvent): Promise<string> {
  const userId = getCurrentUserId(event);
  const result = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  const user = result.Item as User | undefined;
  if (!user) throw new HttpError(403, "ユーザー情報が見つかりません");
  return user.memberCategoryId;
}

// ---------------------------------------------------------------------------
// BulletinCategories（表示カテゴリー一覧。manageBulletinCategories権限を持つ人のみ変更可）
// ---------------------------------------------------------------------------

async function listCategories() {
  const result = await docClient.send(new ScanCommand({ TableName: BULLETIN_CATEGORIES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function createCategory(event: APIGatewayProxyEvent) {
  // テーブルが空(=組織初期セットアップ前)の場合に限り、権限チェック無しで作成できる。
  if (!(await isTableEmpty(BULLETIN_CATEGORIES_TABLE_NAME))) {
    await requirePermission(event, "manageBulletinCategories", USERS_TABLE_NAME);
  }

  const input = parseJsonBody<Omit<BulletinCategory, "categoryId"> & { categoryId?: string }>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");

  const categoryId = input.categoryId ?? randomUUID();
  const existing = await fetchCategory(categoryId);
  if (existing) throw new HttpError(409, "このcategoryIdは既に登録されています");

  const category: BulletinCategory = { categoryId, name: input.name };
  await docClient.send(new PutCommand({ TableName: BULLETIN_CATEGORIES_TABLE_NAME, Item: category }));
  return jsonResponse(201, category);
}

async function updateCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageBulletinCategories", USERS_TABLE_NAME);

  const input = parseJsonBody<Partial<BulletinCategory>>(event);
  const current = await fetchCategory(categoryId);
  if (!current) throw new HttpError(404, "掲示板カテゴリーが見つかりません");

  const updated: BulletinCategory = { ...current, ...input, categoryId };
  await docClient.send(new PutCommand({ TableName: BULLETIN_CATEGORIES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageBulletinCategories", USERS_TABLE_NAME);

  const current = await fetchCategory(categoryId);
  if (!current) throw new HttpError(404, "掲示板カテゴリーが見つかりません");

  const postsWithCategory = await docClient.send(
    new ScanCommand({
      TableName: BULLETIN_POSTS_TABLE_NAME,
      FilterExpression: "categoryId = :categoryId",
      ExpressionAttributeValues: { ":categoryId": categoryId },
      ProjectionExpression: "postId",
    }),
  );
  if ((postsWithCategory.Items ?? []).length > 0) {
    throw new HttpError(409, "このカテゴリーは現在投稿に使用されているため削除できません");
  }

  await docClient.send(new DeleteCommand({ TableName: BULLETIN_CATEGORIES_TABLE_NAME, Key: { categoryId } }));
  return jsonResponse(204, {});
}

async function fetchCategory(categoryId: string): Promise<BulletinCategory | undefined> {
  const result = await docClient.send(
    new GetCommand({ TableName: BULLETIN_CATEGORIES_TABLE_NAME, Key: { categoryId } }),
  );
  return result.Item as BulletinCategory | undefined;
}
