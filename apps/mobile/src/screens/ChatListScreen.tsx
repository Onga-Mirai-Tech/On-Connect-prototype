import { useState } from "react";
import { View, Text, TextInput, FlatList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockChatRooms, mockMembers, mockMessages, mockCurrentUserId } from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<ChatStackParamList, "ChatList">;

/**
 * チャット一覧画面（7章 3番）：1対1／グループチャットの一覧、既読／未読表示
 * 本文検索：入力したキーワードを含むメッセージがあるルームのみに絞り込む。
 * TODO: AppSync側にメッセージ検索クエリを実装し、サーバーサイド検索に置き換える（現状はダミーデータ表示）。
 */
export function ChatListScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");

  const rooms = mockChatRooms
    .filter((room) => room.memberUserIds.includes(mockCurrentUserId))
    .map((room) => {
      const otherMemberId = room.memberUserIds.find((id) => id !== mockCurrentUserId);
      const otherMember = mockMembers.find((m) => m.userId === otherMemberId);
      const displayName = room.isGroup ? room.name ?? "グループ" : otherMember?.displayName ?? "不明なメンバー";
      const roomMessages = mockMessages[room.roomId] ?? [];
      const lastMessage = roomMessages[roomMessages.length - 1];

      if (!query.trim()) {
        return { ...room, displayName, previewMessage: lastMessage, matched: true };
      }
      const matches = roomMessages.filter((m) => m.body.toLowerCase().includes(query.toLowerCase()));
      const bestMatch = matches[matches.length - 1];
      return { ...room, displayName, previewMessage: bestMatch, matched: matches.length > 0 };
    })
    .filter((room) => room.matched)
    .sort((a, b) => (b.previewMessage?.createdAt ?? b.createdAt).localeCompare(a.previewMessage?.createdAt ?? a.createdAt));

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Pressable onPress={() => navigation.navigate("NewDirectMessage")} style={styles.actionButton}>
          <Ionicons name="person-add-outline" size={16} color={colors.brandDark} />
          <Text style={styles.actionText}>個別メッセージ</Text>
        </Pressable>
        <Pressable onPress={() => navigation.navigate("GroupChatCreate")} style={styles.actionButton}>
          <Ionicons name="people-outline" size={16} color={colors.brandDark} />
          <Text style={styles.actionText}>グループ作成</Text>
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="メッセージ本文を検索"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.roomId}
        ListEmptyComponent={
          <Text>{query.trim() ? "一致するメッセージが見つかりません。" : "チャットルームはまだありません。"}</Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => navigation.navigate("ChatRoom", { roomId: item.roomId })} style={styles.roomRow}>
            <Ionicons name={item.isGroup ? "people-outline" : "person-outline"} size={18} color={colors.text} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roomItem}>{item.displayName}</Text>
              {item.previewMessage && (
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.previewMessage.forceNotify ? "【緊急】" : ""}
                  {item.previewMessage.body}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  actions: { flexDirection: "row", gap: 10, marginBottom: 12 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  actionText: { fontWeight: "600", color: colors.brandDark },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10 },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  roomItem: { fontSize: 15, fontWeight: "600" },
  lastMessage: { fontSize: 12, color: colors.textMuted },
});
