import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * 外部リンク集（ブックマーク）のCRUD（5.5）
 * TODO: OrgLinks テーブルに対するシンプルなCRUDを実装する。
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 501,
    body: JSON.stringify({ message: "Not implemented yet", path: event.path }),
  };
};
