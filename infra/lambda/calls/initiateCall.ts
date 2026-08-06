import type { APIGatewayProxyHandler } from "aws-lambda";

/**
 * 1対1音声通話の発信（5.2.4, Amazon Chime SDK）
 * - Chime SDK Meeting/Attendee を作成し、発信者・着信者のセッション情報を返す
 * - CallLogs テーブルに発着信記録を作成する（音声データ自体は保存しない）
 * - 着信通知は、通知オフのユーザーには例外なく届かない（緊急通知フラグの対象外）
 * TODO: @aws-sdk/client-chime-sdk-meetings を用いた CreateMeeting/CreateAttendee 実装、
 *       着信通知（AppSync経由のアプリ内通知＋Pinpoint/SNSプッシュ）の送信を実装する。
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  return {
    statusCode: 501,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify({ message: "Not implemented yet", body: event.body }),
  };
};
