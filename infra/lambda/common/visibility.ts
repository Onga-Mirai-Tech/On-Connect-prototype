import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { ChatRoom } from "@on-connect/shared";
import { docClient } from "./dynamo";

/**
 * 職員カテゴリー単位の閲覧権限フィルタ（設計書5.3.3）。
 * 空配列(=全体公開)、または閲覧者のmemberCategoryIdが含まれる場合に閲覧可能とする。
 * BulletinPost/CalendarEventの両方で共通利用する。
 */
export function isVisibleToCategory(visibleCategoryIds: string[], memberCategoryId: string): boolean {
  return visibleCategoryIds.length === 0 || visibleCategoryIds.includes(memberCategoryId);
}

/** チャット添付ファイルの認可チェック用（Phase 12）。ルームが存在しなければundefinedを返す。 */
export async function fetchChatRoom(
  chatRoomsTableName: string,
  roomId: string,
): Promise<ChatRoom | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: chatRoomsTableName, Key: { roomId } }));
  return result.Item as ChatRoom | undefined;
}

export function isChatRoomMember(room: ChatRoom, userId: string): boolean {
  return room.memberUserIds.includes(userId);
}
