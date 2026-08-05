import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import type { DynamoDBStreamHandler } from "aws-lambda";
import type { ChatRoom, Message, User } from "@on-connect/shared";
import { docClient } from "../common/dynamo";
import { publishPush } from "../common/push";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const CHAT_ROOMS_TABLE_NAME = process.env.CHAT_ROOMS_TABLE_NAME!;
const PUSH_TOPIC_ARN = process.env.PUSH_TOPIC_ARN!;

/**
 * 新着チャットのプッシュ通知（5.1.2 / 5.2.3 / Phase 5メンション対応）
 * 通知対象の決定ロジック（優先順）：
 *   1. forceNotify === true → メンションの有無に関わらずルーム全員（notificationStatusを無視、緊急通知）
 *   2. mentionedUserIds が指定されている → メンション先のみ（各自のnotificationStatusは引き続き考慮）
 *   3. どちらでもない → 従来通りルーム全員のうち notificationStatus === "ON" の人
 * 送信者自身は常に通知対象から除外する。
 * 音声通話の着信通知は本Lambdaの対象外（calls側で別途、例外なくnotificationStatusを尊重する）。
 */
export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "INSERT" || !record.dynamodb?.NewImage) continue;

    const message = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>) as Message;
    const targetUserIds = await resolveTargetUserIds(message);
    if (targetUserIds.length === 0) continue;

    await publishPush(PUSH_TOPIC_ARN, {
      type: "chat_message",
      roomId: message.roomId,
      messageId: message.messageId,
      senderId: message.senderId,
      forceNotify: message.forceNotify,
      targetUserIds,
    });
  }
};

async function resolveTargetUserIds(message: Message): Promise<string[]> {
  let candidateIds: string[];

  if (message.forceNotify || !message.mentionedUserIds?.length) {
    const room = await fetchRoom(message.roomId);
    if (!room) return [];
    candidateIds = room.memberUserIds;
  } else {
    candidateIds = message.mentionedUserIds;
  }

  candidateIds = candidateIds.filter((userId) => userId !== message.senderId);
  if (candidateIds.length === 0) return [];
  if (message.forceNotify) return candidateIds;

  const users = await fetchUsers(candidateIds);
  return users.filter((u) => u.notificationStatus === "ON").map((u) => u.userId);
}

async function fetchRoom(roomId: string): Promise<ChatRoom | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: CHAT_ROOMS_TABLE_NAME, Key: { roomId } }));
  return result.Item as ChatRoom | undefined;
}

async function fetchUsers(userIds: string[]): Promise<Pick<User, "userId" | "notificationStatus">[]> {
  const results = await Promise.all(
    userIds.map((userId) =>
      docClient.send(
        new GetCommand({
          TableName: USERS_TABLE_NAME,
          Key: { userId },
          ProjectionExpression: "userId, notificationStatus",
        }),
      ),
    ),
  );
  return results
    .map((r) => r.Item as Pick<User, "userId" | "notificationStatus"> | undefined)
    .filter((u): u is Pick<User, "userId" | "notificationStatus"> => u !== undefined);
}
