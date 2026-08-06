import { generateClient, type GraphQLQuery, type GraphQLSubscription } from "aws-amplify/api";
import type { ChatRoom, Message } from "@on-connect/shared";

const GRAPHQL_API_URL = import.meta.env.VITE_GRAPHQL_API_URL;

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

const CHAT_ROOM_FIELDS = `roomId isGroup name memberUserIds createdAt`;
const MESSAGE_FIELDS = `messageId roomId senderId body attachmentKeys readByUserIds status scheduledAt forceNotify mentionedUserIds createdAt`;

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
const onMessageSentSubscription = `subscription OnMessageSent($roomId: ID!) {
  onMessageSent(roomId: $roomId) { ${MESSAGE_FIELDS} }
}`;
const onMessageReadSubscription = `subscription OnMessageRead($roomId: ID!) {
  onMessageRead(roomId: $roomId) { ${MESSAGE_FIELDS} }
}`;

function ensureConfigured() {
  if (!GRAPHQL_API_URL) throw new ChatApiError("API未接続");
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
      variables: { input },
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
};
