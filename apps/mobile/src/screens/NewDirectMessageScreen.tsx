import { useState } from "react";
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockChatRooms, memberMatchesQuery } from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";

type Props = NativeStackScreenProps<ChatStackParamList, "NewDirectMessage">;

/**
 * 個別メッセージ開始画面（登録メンバーを検索し、1対1チャットを開く窓口）
 * Phase 8d：既存ルームをAppSyncで検索し、無ければcreateRoomで新規作成する（失敗時はダミーデータで
 * 遷移のみ行う従来の簡易フォールバック）。
 */
export function NewDirectMessageScreen({ navigation }: Props) {
  const { currentUserId } = useAuth();
  const { members: allMembers } = useOrgData();
  const [query, setQuery] = useState("");
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const members = allMembers.filter((m) => m.userId !== currentUserId);

  const handleSelect = async (userId: string) => {
    if (!currentUserId) return;
    setCreatingUserId(userId);
    try {
      const rooms = await chatClient.listChatRoomsForUser(currentUserId);
      const existingRoom = rooms.find((r) => !r.isGroup && r.memberUserIds.includes(userId));
      if (existingRoom) {
        navigation.navigate("ChatRoom", { roomId: existingRoom.roomId });
        return;
      }
      const created = await chatClient.createRoom({ isGroup: false, memberUserIds: [currentUserId, userId] });
      navigation.navigate("ChatRoom", { roomId: created.roomId });
    } catch {
      const existingRoom = mockChatRooms.find(
        (r) => !r.isGroup && r.memberUserIds.includes(currentUserId) && r.memberUserIds.includes(userId),
      );
      navigation.navigate("ChatRoom", { roomId: existingRoom?.roomId ?? `dm-${userId}` });
    } finally {
      setCreatingUserId(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="メンバー名・ふりがなで検索"
          value={query}
          onChangeText={setQuery}
        />
      </View>
      <FlatList
        data={members.filter((m) => memberMatchesQuery(m, query))}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={<Text>登録メンバーが見つかりません。</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => handleSelect(item.userId)}
            disabled={creatingUserId === item.userId}
            style={styles.row}
          >
            <Ionicons name="person-circle-outline" size={22} color={colors.brandDark} />
            <Text style={styles.name}>{item.displayName}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
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
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10 },
  name: { fontSize: 15 },
});
