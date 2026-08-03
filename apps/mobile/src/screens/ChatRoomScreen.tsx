import { useState } from "react";
import { View, Text, TextInput, Pressable, Switch, StyleSheet, FlatList } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  mockChatRooms,
  mockMembers,
  mockMessages,
  mockCurrentUserId,
  type Message,
} from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatRoom">;

const memberName = (userId: string) => mockMembers.find((m) => m.userId === userId)?.displayName ?? userId;

/**
 * チャット詳細画面（7章 3番）
 * メッセージ作成時に予約送信・緊急通知オプション、1対1トークには発信ボタンを表示（5.2.2〜5.2.4）
 * TODO: AppSyncのクエリ・ミューテーション・サブスクリプションに置き換える（現状はダミーデータ表示）
 */
export function ChatRoomScreen({ route }: Props) {
  const { roomId } = route.params;
  const room = mockChatRooms.find((r) => r.roomId === roomId);
  const otherMemberId = room?.memberUserIds.find((id) => id !== mockCurrentUserId);
  const roomTitle = room ? (room.isGroup ? room.name ?? "グループ" : memberName(otherMemberId ?? "")) : roomId;

  const [messages, setMessages] = useState<Message[]>(mockMessages[roomId] ?? []);
  const [body, setBody] = useState("");
  const [forceNotify, setForceNotify] = useState(false);

  const handleSend = () => {
    if (!body.trim()) return;
    // TODO: AppSync sendMessage mutation を呼び出す
    setMessages((prev) => [
      ...prev,
      {
        messageId: `local-${Date.now()}`,
        roomId,
        senderId: mockCurrentUserId,
        body,
        readByUserIds: [mockCurrentUserId],
        status: "sent",
        forceNotify,
        createdAt: new Date().toISOString(),
      },
    ]);
    setBody("");
    setForceNotify(false);
  };

  const handleCall = () => {
    // TODO: POST /calls を呼び出し、Chime SDK Meeting/Attendee 情報を取得して発信する
    // TODO: 発信中UI（自分が発信した側の画面）へ遷移する
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{roomTitle}</Text>
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
          const isSelf = item.senderId === mockCurrentUserId;
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
                <Text>{item.body}</Text>
              </View>
            </View>
          );
        }}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="メッセージを入力"
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
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16 },
  title: { fontWeight: "700" },
  callButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  messages: { flex: 1, paddingHorizontal: 16 },
  bubbleWrap: { marginBottom: 8 },
  senderName: { fontSize: 11, color: colors.textMuted, marginBottom: 2 },
  bubble: { borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, maxWidth: "80%" },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 2 },
  forceNotifyTag: { fontSize: 11, fontWeight: "700", color: colors.danger },
  composer: { padding: 16, gap: 8 },
  input: { backgroundColor: colors.surface, borderRadius: 12, padding: 10, minHeight: 44 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  sendButton: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, backgroundColor: colors.brand, borderRadius: 12, padding: 12 },
  sendButtonText: { fontWeight: "700" },
});
