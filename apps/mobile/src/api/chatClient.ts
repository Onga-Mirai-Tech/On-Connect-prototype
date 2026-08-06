import { generateClient, type GraphQLQuery, type GraphQLSubscription } from "aws-amplify/api";
import type { ChatRoom, Message } from "@on-connect/shared";

const GRAPHQL_API_URL = process.env.EXPO_PUBLIC_GRAPHQL_API_URL;

class ChatApiError extends Error {}

const client = generateClient();

export interface SendMessageInput {
  roomId: string;
  senderId: string;
  body: string;
  attachmentKeys?: string[];
  scheduledAt?: string;
  forceNotify?: boolean;
  mentionedUserIds?: string[];
}

export interface MarkReadInput {
  roomId: string;
  messageId: string;
  userId: string;
}

export interface CreateRoomInput {
  isGroup: boolean;
  name?: string;
  memberUserIds: string[];
}

export interface ToggleReactionInput {
  roomId: string;
  messageId: string;
  emoji: string;
  userId: string;
}

const CHAT_ROOM_FIELDS = `roomId isGroup name memberUserIds createdAt`;
const MESSAGE_FIELDS = `messageId roomId senderId body attachmentKeys readByUserIds status scheduledAt forceNotify mentionedUserIds reactions { emoji userIds } createdAt`;

const listChatRoomsForUserQuery = `query ListChatRoomsForUser($userId: ID!) {
  listChatRoomsForUser(userId: $userId) { ${CHAT_ROOM_FIELDS} }
}`;
const getChatRoomQuery = `query GetChatRoom($roomId: ID!) {
  getChatRoom(roomId: $roomId) { ${CHAT_ROOM_FIELDS} }
}`;
const listMessagesForRoomQuery = `query ListMessagesForRoom($roomId: ID!, $limit: Int) {
  listMessagesForRoom(roomId: $roomId, limit: $limit) { ${MESSAGE_FIELDS} }
}`;
const sendMessageMutation = `mutation SendMessage($input: SendMessageInput!) {
  sendMessage(input: $input) { ${MESSAGE_FIELDS} }
}`;
const markMessageReadMutation = `mutation MarkMessageRead($input: MarkReadInput!) {
  markMessageRead(input: $input) { ${MESSAGE_FIELDS} }
}`;
const createRoomMutation = `mutation CreateRoom($input: CreateRoomInput!) {
  createRoom(input: $input) { ${CHAT_ROOM_FIELDS} }
}`;
const toggleMessageReactionMutation = `mutation ToggleMessageReaction($input: ToggleReactionInput!) {
  toggleMessageReaction(input: $input) { ${MESSAGE_FIELDS} }
}`;
const onMessageSentSubscription = `subscription OnMessageSent($roomId: ID!) {
  onMessageSent(roomId: $roomId) { ${MESSAGE_FIELDS} }
}`;
const onMessageReadSubscription = `subscription OnMessageRead($roomId: ID!) {
  onMessageRead(roomId: $roomId) { ${MESSAGE_FIELDS} }
}`;
const onMessageReactionChangedSubscription = `subscription OnMessageReactionChanged($roomId: ID!) {
  onMessageReactionChanged(roomId: $roomId) { ${MESSAGE_FIELDS} }
}`;
const cancelScheduledMessageMutation = `mutation CancelScheduledMessage($roomId: ID!, $messageId: ID!) {
  cancelScheduledMessage(roomId: $roomId, messageId: $messageId) { ${MESSAGE_FIELDS} }
}`;

function ensureConfigured() {
  if (!GRAPHQL_API_URL) throw new ChatApiError("API未接続");
}

/**
 * 予約送信欄への入力（"YYYY-MM-DDTHH:mm"、秒・タイムゾーン無し）を、AWSDateTimeが要求する
 * 秒・タイムゾーン付きのISO8601形式に変換する。園の所在地がAsia/Tokyo固定という設計上の前提に従い、
 * 入力された時刻をJSTとして扱う。
 */
function toAwsDateTime(localDateTime: string): string {
  const withSeconds = localDateTime.length === 16 ? `${localDateTime}:00` : localDateTime;
  return `${withSeconds}+09:00`;
}

export const chatClient = {
  listChatRoomsForUser: async (userId: string): Promise<ChatRoom[]> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ listChatRoomsForUser: ChatRoom[] }>>({
      query: listChatRoomsForUserQuery,
      variables: { userId },
    });
    return res.data.listChatRoomsForUser;
  },

  getChatRoom: async (roomId: string): Promise<ChatRoom | undefined> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ getChatRoom: ChatRoom | null }>>({
      query: getChatRoomQuery,
      variables: { roomId },
    });
    return res.data.getChatRoom ?? undefined;
  },

  listMessagesForRoom: async (roomId: string, limit = 50): Promise<Message[]> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ listMessagesForRoom: Message[] }>>({
      query: listMessagesForRoomQuery,
      variables: { roomId, limit },
    });
    return res.data.listMessagesForRoom;
  },

  sendMessage: async (input: SendMessageInput): Promise<Message> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ sendMessage: Message }>>({
      query: sendMessageMutation,
      variables: {
        input: input.scheduledAt ? { ...input, scheduledAt: toAwsDateTime(input.scheduledAt) } : input,
      },
    });
    return res.data.sendMessage;
  },

  markMessageRead: async (input: MarkReadInput): Promise<Message> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ markMessageRead: Message }>>({
      query: markMessageReadMutation,
      variables: { input },
    });
    return res.data.markMessageRead;
  },

  createRoom: async (input: CreateRoomInput): Promise<ChatRoom> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ createRoom: ChatRoom }>>({
      query: createRoomMutation,
      variables: { input },
    });
    return res.data.createRoom;
  },

  toggleMessageReaction: async (input: ToggleReactionInput): Promise<Message> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ toggleMessageReaction: Message }>>({
      query: toggleMessageReactionMutation,
      variables: { input },
    });
    return res.data.toggleMessageReaction;
  },

  /** 予約中メッセージの取消（Phase 10）。送信予定時刻より前のみ成功する（バックエンド側でstatus条件チェック） */
  cancelScheduledMessage: async (roomId: string, messageId: string): Promise<Message> => {
    ensureConfigured();
    const res = await client.graphql<GraphQLQuery<{ cancelScheduledMessage: Message }>>({
      query: cancelScheduledMessageMutation,
      variables: { roomId, messageId },
    });
    return res.data.cancelScheduledMessage;
  },

  /** 新着メッセージを購読する。戻り値の関数を呼ぶと購読解除する。 */
  subscribeToMessages: (roomId: string, onNext: (message: Message) => void): (() => void) => {
    const sub = client
      .graphql<GraphQLSubscription<{ onMessageSent: Message }>>({
        query: onMessageSentSubscription,
        variables: { roomId },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.onMessageSent) onNext(data.onMessageSent);
        },
        error: (err) => console.error("subscribeToMessages error", err),
      });
    return () => sub.unsubscribe();
  },

  /** 既読更新を購読する。戻り値の関数を呼ぶと購読解除する。 */
  subscribeToReads: (roomId: string, onNext: (message: Message) => void): (() => void) => {
    const sub = client
      .graphql<GraphQLSubscription<{ onMessageRead: Message }>>({
        query: onMessageReadSubscription,
        variables: { roomId },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.onMessageRead) onNext(data.onMessageRead);
        },
        error: (err) => console.error("subscribeToReads error", err),
      });
    return () => sub.unsubscribe();
  },

  /** リアクション変更を購読する。戻り値の関数を呼ぶと購読解除する。 */
  subscribeToReactions: (roomId: string, onNext: (message: Message) => void): (() => void) => {
    const sub = client
      .graphql<GraphQLSubscription<{ onMessageReactionChanged: Message }>>({
        query: onMessageReactionChangedSubscription,
        variables: { roomId },
      })
      .subscribe({
        next: ({ data }) => {
          if (data?.onMessageReactionChanged) onNext(data.onMessageReactionChanged);
        },
        error: (err) => console.error("subscribeToReactions error", err),
      });
    return () => sub.unsubscribe();
  },
};
