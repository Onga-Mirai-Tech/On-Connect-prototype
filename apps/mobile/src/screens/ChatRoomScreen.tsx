import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockChatRooms, mockMessages, toggleReaction, type ChatRoom, type Message } from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { ReactionBar } from "../components/ReactionBar";
import { MemberPicker } from "../components/MemberPicker";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatRoom">;

/** 本文末尾の "@検索語" にマッチする（カーソルが末尾にある前提の簡易実装） */
const mentionPattern = /@([^\s@]*)$/;

/** 同じmessageIdなら置き換え、無ければ追加する（sendMessage/markMessageReadの購読を同じロジックで扱う） */
function upsertMessage(messages: Message[], incoming: Message): Message[] {
  const idx = messages.findIndex((m) => m.messageId === incoming.messageId);
  if (idx === -1) return [...messages, incoming];
  const next = [...messages];
  next[idx] = incoming;
  return next;
}

/**
 * チャット詳細画面（7章 3番）
 * メッセージ作成時に緊急通知オプション、1対1トークには発信ボタンを表示（5.2.2〜5.2.4）
 * Phase 8d：AppSyncのクエリ・ミューテーション・サブスクリプションに接続（失敗時はダミーデータに
 * フォールバック）。リアクションはスキーマ未対応のためローカルstateのまま（Phase 9で対応）。
 */
export function ChatRoomScreen({ route }: Props) {
  const { currentUserId } = useAuth();
  const { members } = useOrgData();
  const { roomId } = route.params;
  const memberName = (userId: string) => members.find((m) => m.userId === userId)?.displayName ?? userId;

  const [room, setRoom] = useState<ChatRoom | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [forceNotify, setForceNotify] = useState(false);
  const [mentionedUserIds, setMentionedUserIds] = useState<string[]>([]);
  const markingReadRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      try {
        const [fetchedRoom, fetchedMessages] = await Promise.all([
          chatClient.getChatRoom(roomId),
          chatClient.listMessagesForRoom(roomId),
        ]);
        setRoom(fetchedRoom);
        setMessages(fetchedMessages);
      } catch {
        setRoom(mockChatRooms.find((r) => r.roomId === roomId));
        setMessages(mockMessages[roomId] ?? []);
      }
    })();

    const unsubscribeSent = chatClient.subscribeToMessages(roomId, (message) => {
      setMessages((prev) => upsertMessage(prev, message));
    });
    const unsubscribeRead = chatClient.subscribeToReads(roomId, (message) => {
      setMessages((prev) => upsertMessage(prev, message));
    });
    markingReadRef.current = new Set();
    return () => {
      unsubscribeSent();
      unsubscribeRead();
    };
  }, [roomId]);

  // 自分宛て（送信者以外）の未読メッセージを表示した時点で既読にする（既読UI自体は新設しない）
  useEffect(() => {
    if (!currentUserId) return;
    for (const m of messages) {
      if (m.senderId === currentUserId) continue;
      if (m.readByUserIds.includes(currentUserId)) continue;
      if (markingReadRef.current.has(m.messageId)) continue;
      markingReadRef.current.add(m.messageId);
      chatClient
        .markMessageRead({ roomId, messageId: m.messageId, userId: currentUserId })
        .catch(() => markingReadRef.current.delete(m.messageId));
    }
  }, [messages, currentUserId, roomId]);

  const otherMemberId = room?.memberUserIds.find((id) => id !== currentUserId);
  const otherMember = members.find((m) => m.userId === otherMemberId);
  const roomTitle = room ? (room.isGroup ? room.name ?? "グループ" : otherMember?.displayName ?? "") : roomId;
  const participantNames = room?.isGroup ? room.memberUserIds.map((id) => memberName(id)).join("、") : "";

  const roomMembers = members.filter(
    (m) => room?.memberUserIds.includes(m.userId) && m.userId !== currentUserId,
  );
  const mentionMatch = mentionPattern.exec(body);

  const handleSelectMention = (member: (typeof roomMembers)[number]) => {
    if (!mentionMatch) return;
    const prefix = body.slice(0, body.length - mentionMatch[0].length);
    setBody(`${prefix}@${member.displayName} `);
    setMentionedUserIds((prev) => (prev.includes(member.userId) ? prev : [...prev, member.userId]));
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    try {
      const sent = await chatClient.sendMessage({
        roomId,
        senderId: currentUserId ?? "",
        body,
        forceNotify,
        mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
      });
      setMessages((prev) => upsertMessage(prev, sent));
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          messageId: `local-${Date.now()}`,
          roomId,
          senderId: currentUserId ?? "",
          body,
          readByUserIds: [currentUserId ?? ""],
          status: "sent",
          forceNotify,
          mentionedUserIds: mentionedUserIds.length > 0 ? mentionedUserIds : undefined,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    setBody("");
    setForceNotify(false);
    setMentionedUserIds([]);
  };

  const handleCall = () => {
    // TODO: POST /calls を呼び出し、Chime SDK Meeting/Attendee 情報を取得して発信する
    // TODO: 発信中UI（自分が発信した側の画面）へ遷移する
  };

  const handleToggleReaction = (messageId: string, emoji: string) => {
    // TODO: リアクション永続化はPhase 9対応（スキーマにフィールドが無い）
    setMessages((prev) =>
      prev.map((m) =>
        m.messageId === messageId ? { ...m, reactions: toggleReaction(m.reactions, emoji, currentUserId ?? "") } : m,
      ),
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{roomTitle}</Text>
          {room?.isGroup && (
            <View style={styles.participantsRow}>
              <Ionicons name="people-outline" size={13} color={colors.textMuted} />
              <Text style={styles.participantsText} numberOfLines={2}>
                {participantNames}
              </Text>
            </View>
          )}
          {room && !room.isGroup && otherMember && (
            <View style={styles.participantsRow}>
              {otherMember.notificationStatus === "ON" ? (
                <>
                  <Ionicons name="notifications-outline" size={13} color={colors.brandDark} />
                  <Text style={[styles.statusText, { color: colors.brandDark }]}>通知ON</Text>
                </>
              ) : (
                <>
                  <Ionicons name="notifications-off-outline" size={13} color={colors.textMuted} />
                  <Text style={styles.statusText}>通知OFF（相手には届きにくい状態です）</Text>
                </>
              )}
            </View>
          )}
        </View>
        {room && !room.isGroup && (
          <Pressable onPress={handleCall} style={styles.callButton}>
            <Ionicons name="call-outline" size={18} color={colors.brandDark} />
            <Text>発信</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        style={styles.messages}
        data={messages}
        keyExtractor={(item) => item.messageId}
        ListEmptyComponent={<Text>メッセージはまだありません。</Text>}
        renderItem={({ item }) => {
          const isSelf = item.senderId === currentUserId;
          return (
            <View style={[styles.bubbleWrap, { alignItems: isSelf ? "flex-end" : "flex-start" }]}>
              {room?.isGroup && !isSelf && <Text style={styles.senderName}>{memberName(item.senderId)}</Text>}
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: item.forceNotify ? "#FDECEC" : isSelf ? colors.brand : colors.surface },
                  item.forceNotify && { borderWidth: 1, borderColor: colors.danger },
                ]}
              >
                {item.forceNotify && (
                  <View style={styles.tagRow}>
                    <Ionicons name="alert-circle-outline" size={12} color={colors.danger} />
                    <Text style={styles.forceNotifyTag}>緊急連絡</Text>
                  </View>
                )}
                {!!item.mentionedUserIds?.length && (
                  <View style={styles.tagRow}>
                    <Ionicons name="at-outline" size={12} color={colors.brandDark} />
                    <Text style={styles.mentionTag}>
                      {item.mentionedUserIds.map((id) => memberName(id)).join("、")} 宛
                    </Text>
                  </View>
                )}
                <Text>{item.body}</Text>
              </View>
              <View style={styles.reactionRow}>
                <ReactionBar
                  reactions={item.reactions}
                  currentUserId={currentUserId ?? ""}
                  onToggle={(emoji) => handleToggleReaction(item.messageId, emoji)}
                />
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        {room?.isGroup && mentionMatch && (
          <MemberPicker members={roomMembers} query={mentionMatch[1]} onSelect={handleSelectMention} />
        )}
        <TextInput
          style={styles.input}
          placeholder={room?.isGroup ? "メッセージを入力（@でメンション）" : "メッセージを入力"}
          value={body}
          onChangeText={setBody}
          multiline
        />
        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Ionicons name="alert-circle-outline" size={16} color={colors.danger} />
            <Text>緊急連絡として送信</Text>
          </View>
          <Switch value={forceNotify} onValueChange={setForceNotify} />
        </View>
        <Pressable style={styles.sendButton} onPress={handleSend}>
          <Ionicons name="send-outline" size={16} color={colors.text} />
          <Text style={styles.sendButtonText}>送信</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", padding: 16 },
  headerInfo: { flex: 1, marginRight: 8 },
  title: { fontWeight: "700" },
  participantsRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, marginTop: 4 },
  participantsText: { flex: 1, fontSize: 12, color: colors.textMuted },
  statusText: { fontSize: 12, color: colors.textMuted },
  callButton: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  messages: { flex: 1, paddingHorizontal: 16 },
  bubbleWrap: { marginBottom: 8 },
  senderName: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  bubble: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, maxWidth: "80%" },
  reactionRow: { marginTop: 4 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  forceNotifyTag: { fontSize: 11, fontWeight: "700", color: colors.danger },
  mentionTag: { fontSize: 11, fontWeight: "700", color: colors.brandDark },
  composer: { padding: 16, gap: 8 },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: 10, minHeight: 44 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  sendButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.brand, borderRadius: 12, padding: 12 },
  sendButtonText: { fontWeight: "700" },
});
