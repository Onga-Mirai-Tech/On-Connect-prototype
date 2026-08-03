import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * 掲示板CRUD（5.3.1〜5.3.3）
 * TODO: BulletinPosts テーブルのCRUD、visibleCategoryIds によるフィルタリングを実装する。
 * 通知送信自体はテーブルStreams経由で notifyOnPost.ts が処理する。
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 501,
    body: JSON.stringify({ message: "Not implemented yet", path: event.path }),
  };
};
