import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { DeleteCommand, GetCommand, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import type { BulletinPost, User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import {
  HttpError,
  getCurrentUserId,
  handleRequest,
  jsonResponse,
  parseJsonBody,
  requireParam,
} from "../common/http";

const BULLETIN_POSTS_TABLE_NAME = process.env.BULLETIN_POSTS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;

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

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

async function listPosts(event: APIGatewayProxyEvent) {
  const memberCategoryId = await currentUserMemberCategoryId(event);
  const result = await docClient.send(new ScanCommand({ TableName: BULLETIN_POSTS_TABLE_NAME }));
  const posts = (result.Items as BulletinPost[] | undefined) ?? [];
  const visible = posts
    .filter((post) => isVisibleTo(post, memberCategoryId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return jsonResponse(200, visible);
}

async function getPost(postId: string, event: APIGatewayProxyEvent) {
  const post = await fetchPost(postId);
  if (!post) throw new HttpError(404, "投稿が見つかりません");

  const memberCategoryId = await currentUserMemberCategoryId(event);
  if (!isVisibleTo(post, memberCategoryId)) {
    throw new HttpError(403, "この投稿を閲覧する権限がありません");
  }
  return jsonResponse(200, post);
}

async function createPost(event: APIGatewayProxyEvent) {
  const authorId = getCurrentUserId(event);
  const input = parseJsonBody<Pick<BulletinPost, "title" | "category" | "body"> & Partial<BulletinPost>>(
    event,
  );
  if (!input.title) throw new HttpError(400, "title は必須です");
  if (!input.category) throw new HttpError(400, "category は必須です");
  if (!input.body) throw new HttpError(400, "body は必須です");

  const now = new Date().toISOString();
  const post: BulletinPost = {
    postId: randomUUID(),
    title: input.title,
    category: input.category,
    body: input.body,
    authorId,
    visibleCategoryIds: input.visibleCategoryIds ?? [],
    ...(input.attachmentKeys ? { attachmentKeys: input.attachmentKeys } : {}),
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

  await docClient.send(new PutCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deletePost(postId: string) {
  const current = await fetchPost(postId);
  if (!current) throw new HttpError(404, "投稿が見つかりません");

  await docClient.send(new DeleteCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Key: { postId } }));
  return jsonResponse(204, {});
}

async function fetchPost(postId: string): Promise<BulletinPost | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: BULLETIN_POSTS_TABLE_NAME, Key: { postId } }));
  return result.Item as BulletinPost | undefined;
}

/** 空配列(=全体公開)、または閲覧者のmemberCategoryIdが含まれる場合に閲覧可能とする（設計書5.3.3） */
function isVisibleTo(post: BulletinPost, memberCategoryId: string): boolean {
  return post.visibleCategoryIds.length === 0 || post.visibleCategoryIds.includes(memberCategoryId);
}

async function currentUserMemberCategoryId(event: APIGatewayProxyEvent): Promise<string> {
  const userId = getCurrentUserId(event);
  const result = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  const user = result.Item as User | undefined;
  if (!user) throw new HttpError(403, "ユーザー情報が見つかりません");
  return user.memberCategoryId;
}
