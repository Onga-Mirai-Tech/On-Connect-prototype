import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import {
  ChimeSDKMeetingsClient,
  CreateMeetingCommand,
  CreateAttendeeCommand,
  DeleteMeetingCommand,
} from "@aws-sdk/client-chime-sdk-meetings";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { CallLog, CallStatus, User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import { callAppSyncGraphQL } from "../common/appsyncSigner";
import { publishPush } from "../common/push";
import { HttpError, getCurrentUserId, handleRequest, jsonResponse, parseJsonBody, requireParam } from "../common/http";

const CALL_LOGS_TABLE_NAME = process.env.CALL_LOGS_TABLE_NAME!;
const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CHAT_API_URL = process.env.CHAT_API_URL!;
const PUSH_TOPIC_ARN = process.env.PUSH_TOPIC_ARN!;
/** 園の所在地がAsia/Tokyo固定という設計上の前提に従い、Chime SDK Meetingsのメディアリージョンも固定する */
const MEDIA_REGION = "ap-northeast-1";

const chimeClient = new ChimeSDKMeetingsClient({ region: MEDIA_REGION });

const notifyIncomingCallMutation = `mutation NotifyIncomingCall($input: NotifyIncomingCallInput!) {
  notifyIncomingCall(input: $input) { callId }
}`;

/**
 * 1対1音声通話の発信・終了（5.2.4, Amazon Chime SDK）
 * - CallLogsへの記録は通話終了時（POST /calls/{callId}/end）にまとめて1回だけ行う
 *   （発信時点では応答結果（completed/missed/declined）が確定しないため）
 * - 着信通知は、通知オフのユーザーには例外なく届かない（「つながらない権利」を守るため、
 *   発信自体を409で拒否する）
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/calls" && httpMethod === "POST") return initiateCall(event);
    if (resource === "/calls/{callId}/end" && httpMethod === "POST") return endCall(event);

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

async function initiateCall(event: APIGatewayProxyEvent) {
  const callerId = getCurrentUserId(event);
  const input = parseJsonBody<{ calleeId?: string }>(event);
  if (!input.calleeId) throw new HttpError(400, "calleeId は必須です");
  const calleeId = input.calleeId;
  if (calleeId === callerId) throw new HttpError(400, "自分自身には発信できません");

  const [caller, callee] = await Promise.all([fetchUser(callerId), fetchUser(calleeId)]);
  if (!caller) throw new HttpError(403, "発信者情報が見つかりません");
  if (!callee) throw new HttpError(404, "着信者が見つかりません");
  if (callee.notificationStatus !== "ON") {
    throw new HttpError(409, "このメンバーは現在通知オフのため発信できません");
  }

  const callId = randomUUID();
  const meeting = await chimeClient.send(
    new CreateMeetingCommand({
      ClientRequestToken: callId,
      MediaRegion: MEDIA_REGION,
      ExternalMeetingId: callId,
    }),
  );
  const meetingId = meeting.Meeting?.MeetingId;
  if (!meetingId) throw new Error("Chime Meetingの作成に失敗しました");

  const [callerAttendee, calleeAttendee] = await Promise.all([
    chimeClient.send(new CreateAttendeeCommand({ MeetingId: meetingId, ExternalUserId: callerId })),
    chimeClient.send(new CreateAttendeeCommand({ MeetingId: meetingId, ExternalUserId: calleeId })),
  ]);

  // アプリ内リアルタイム通知（AppSync）。失敗してもプッシュ通知は別途送るため、発信自体は継続する
  try {
    await callAppSyncGraphQL(CHAT_API_URL, notifyIncomingCallMutation, {
      input: {
        callId,
        callerId,
        callerName: caller.displayName,
        calleeId,
        meetingJson: JSON.stringify(meeting),
        calleeAttendeeJson: JSON.stringify(calleeAttendee),
      },
    });
  } catch (err) {
    console.error("notifyIncomingCall呼び出しに失敗しました（アプリ内リアルタイム通知は届かない）", err);
  }

  await publishPush(PUSH_TOPIC_ARN, {
    type: "incoming_call",
    callId,
    callerId,
    callerName: caller.displayName,
    targetUserIds: [calleeId],
  });

  return jsonResponse(201, { callId, meeting, callerAttendee });
}

async function endCall(event: APIGatewayProxyEvent) {
  const requesterId = getCurrentUserId(event);
  const callId = requireParam(event, "callId");
  const input = parseJsonBody<{
    callerId?: string;
    calleeId?: string;
    startTime?: string;
    status?: CallStatus;
  }>(event);
  if (!input.callerId || !input.calleeId || !input.startTime || !input.status) {
    throw new HttpError(400, "callerId・calleeId・startTime・status は必須です");
  }
  if (requesterId !== input.callerId && requesterId !== input.calleeId) {
    throw new HttpError(403, "この通話の当事者のみが終了記録を書き込めます");
  }

  try {
    await chimeClient.send(new DeleteMeetingCommand({ MeetingId: callId }));
  } catch (err) {
    // 既に終了済み・存在しないMeetingへのDeleteは記録自体を止める理由にしない
    console.error("Chime Meetingの削除に失敗しました", err);
  }

  const endTime = new Date().toISOString();
  const callLog: CallLog = {
    callId,
    callerId: input.callerId,
    calleeId: input.calleeId,
    startTime: input.startTime,
    endTime,
    status: input.status,
    ...(input.status === "completed"
      ? { durationSeconds: Math.max(0, Math.round((Date.parse(endTime) - Date.parse(input.startTime)) / 1000)) }
      : {}),
  };
  await docClient.send(new PutCommand({ TableName: CALL_LOGS_TABLE_NAME, Item: callLog }));

  return jsonResponse(200, callLog);
}

async function fetchUser(userId: string): Promise<User | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  return result.Item as User | undefined;
}
