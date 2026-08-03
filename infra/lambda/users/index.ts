import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * ユーザー・ロール・メンバーカテゴリ管理API（5.1）
 * TODO: DynamoDBDocumentClientでUsers/Roles/MemberCategoriesテーブルのCRUDを実装する。
 * ロール削除・変更時は「最後の1名の管理者は削除できない」ガード（5.1.3）をここで実装する。
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 501,
    body: JSON.stringify({
      message: "Not implemented yet",
      httpMethod: event.httpMethod,
      path: event.path,
    }),
  };
};
