import { useState } from "react";
import { View, TextInput, FlatList, Pressable, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockMembers, mockChatRooms, memberMatchesQuery } from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<ChatStackParamList, "NewDirectMessage">;

/**
 * 個別メッセージ開始画面（登録メンバーを検索し、1対1チャットを開く窓口）
 * TODO: GET /users でメンバー一覧を取得する（現状はダミーデータ表示）。
 */
export function NewDirectMessageScreen({ navigation }: Props) {
  const { currentUserId } = useAuth();
  const [query, setQuery] = useState("");
  const members = mockMembers.filter((m) => m.userId !== currentUserId);

  const handleSelect = (userId: string) => {
    const existingRoom = mockChatRooms.find(
      (r) => !r.isGroup && r.memberUserIds.includes(currentUserId ?? "") && r.memberUserIds.includes(userId),
    );
    navigation.navigate("ChatRoom", { roomId: existingRoom?.roomId ?? `dm-${userId}` });
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
          <Pressable onPress={() => handleSelect(item.userId)} style={styles.row}>
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
