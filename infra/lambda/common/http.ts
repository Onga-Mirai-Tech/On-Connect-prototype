import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

/** ハンドラ内で意図的に返すエラー。statusCodeとメッセージをそのままレスポンスにする。 */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/** JSON以外（.ics等）のレスポンスを返す共通ヘルパー */
export function rawResponse(
  statusCode: number,
  contentType: string,
  body: string,
  extraHeaders: Record<string, string> = {},
): APIGatewayProxyResult {
  return {
    statusCode,
    headers: { "Content-Type": contentType, ...extraHeaders },
    body,
  };
}

export function parseJsonBody<T>(event: APIGatewayProxyEvent): T {
  if (!event.body) {
    throw new HttpError(400, "リクエストボディが空です");
  }
  try {
    return JSON.parse(event.body) as T;
  } catch {
    throw new HttpError(400, "リクエストボディがJSONとして不正です");
  }
}

/** API GatewayのCognito Authorizerが設定するクレームから、現在のユーザーID(Cognito sub)を取得する */
export function getCurrentUserId(event: APIGatewayProxyEvent): string {
  const sub = event.requestContext.authorizer?.claims?.sub;
  if (!sub) {
    throw new HttpError(401, "認証情報が見つかりません");
  }
  return sub as string;
}

export function requireParam(event: APIGatewayProxyEvent, name: string): string {
  const value = event.pathParameters?.[name];
  if (!value) {
    throw new HttpError(400, `パスパラメータ ${name} が必要です`);
  }
  return value;
}

/**
 * ルーティング処理・DB操作中の例外を捕捉し、HttpErrorはそのステータスで、
 * それ以外は500として返す共通ラッパー。
 */
export async function handleRequest(
  fn: () => Promise<APIGatewayProxyResult>,
): Promise<APIGatewayProxyResult> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return jsonResponse(err.statusCode, { message: err.message });
    }
    console.error(err);
    return jsonResponse(500, { message: "内部エラーが発生しました" });
  }
}
