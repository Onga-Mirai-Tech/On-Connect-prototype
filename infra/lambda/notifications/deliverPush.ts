import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { SNSHandler } from "aws-lambda";
import type { User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";

interface PushPayload {
  type: "chat_message" | "calendar_reminder" | "bulletin_post" | "incoming_call";
  targetUserIds: string[];
  [key: string]: unknown;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

interface ResolvedToken {
  userId: string;
  token: string;
}

/**
 * SNS PushNotificationsTopicをsubscribeし、Expo Push Notification Serviceで実配信する（Phase 13）。
 * publishPush呼び出し元（chat_message/calendar_reminder/bulletin_post/incoming_call）が積んだ
 * targetUserIdsをUsersTableのexpoPushTokenへ解決し、トークンを持つユーザーのみへExpoのPush APIを
 * 1回のリクエストでまとめて送る（この規模の組織なら1リクエスト上限100件を超えない想定、
 * 超過時の分割送信は未対応）。
 * Expo公式は送信直後のticket確認に加え、後日receiptを取得する2段階検証を推奨しているが、
 * この規模でのMVPとしてはticket時点で判明する`DeviceNotRegistered`の掃除のみを行い、
 * receiptポーリングはスコープ外とする（既知の簡略化）。
 */
export const handler: SNSHandler = async (event) => {
  for (const record of event.Records) {
    const payload = JSON.parse(record.Sns.Message) as PushPayload;
    const content = buildNotificationContent(payload);
    if (!content) continue;

    const tokens = await resolveTokens(payload.targetUserIds);
    if (tokens.length === 0) continue;

    const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({ to: token, ...content }));
    const tickets = await sendExpoPush(messages);
    await pruneStaleTokens(tokens, tickets);
  }
};

/** typeごとにExpo通知のタイトル・本文・タップ時遷移用dataを組み立てる。未知のtypeは通知しない */
function buildNotificationContent(payload: PushPayload): { title: string; body: string; data: Record<string, unknown> } | undefined {
  switch (payload.type) {
    case "chat_message":
      return {
        title: String(payload.senderName ?? "メンバー"),
        body: String(payload.bodyPreview ?? ""),
        data: { type: payload.type, roomId: payload.roomId },
      };
    case "calendar_reminder":
      return {
        title: "本日の予定",
        body: String(payload.title ?? ""),
        data: { type: payload.type, eventId: payload.eventId },
      };
    case "bulletin_post":
      return {
        title: "新着掲示板",
        body: String(payload.title ?? ""),
        data: { type: payload.type, postId: payload.postId },
      };
    case "incoming_call":
      return {
        title: "着信",
        body: String(payload.callerName ?? ""),
        data: { type: payload.type, callId: payload.callId, callerId: payload.callerId },
      };
    default:
      return undefined;
  }
}

/** targetUserIdsのうちexpoPushTokenを持つユーザーだけを解決する（トークン無しは静かに除外） */
async function resolveTokens(userIds: string[]): Promise<ResolvedToken[]> {
  const results = await Promise.all(
    userIds.map(async (userId) => {
      const result = await docClient.send(
        new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId }, ProjectionExpression: "expoPushToken" }),
      );
      const token = (result.Item as Pick<User, "expoPushToken"> | undefined)?.expoPushToken;
      return token ? { userId, token } : undefined;
    }),
  );
  return results.filter((r): r is ResolvedToken => r !== undefined);
}

async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const response = await fetch(EXPO_PUSH_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(messages),
  });
  const json = (await response.json()) as { data?: ExpoPushTicket[] };
  return json.data ?? [];
}

/** ticketの配列順はリクエストしたmessages（=tokens）の順と対応する（Expo仕様）。 */
async function pruneStaleTokens(tokens: ResolvedToken[], tickets: ExpoPushTicket[]): Promise<void> {
  await Promise.all(
    tickets.map(async (ticket, index) => {
      if (ticket.status !== "error" || ticket.details?.error !== "DeviceNotRegistered") return;
      const stale = tokens[index];
      if (!stale) return;

      const current = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId: stale.userId } }));
      if (!current.Item) return;
      const updated: User = { ...(current.Item as User), expoPushToken: undefined };
      await docClient.send(new PutCommand({ TableName: USERS_TABLE_NAME, Item: updated }));
    }),
  );
}
