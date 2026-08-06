import { useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { memberMatchesQuery } from "@on-connect/shared";
import type { ChatStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";

type Props = NativeStackScreenProps<ChatStackParamList, "GroupChatCreate">;

const GROUP_NAME_PREFIX = "GC_";

/**
 * グループチャット作成画面（7章 4番）
 * グループチャット名には作成時に自動で「GC_」を付与する（グループチャットと一目で区別するため）。
 * Phase 8d：メンバー個別選択UIを新設しcreateRoomに接続。
 * 「メンバーカテゴリから一括選択」は既存のTODOのまま対象外（個別選択のみで最低限機能させる）。
 */
export function GroupChatCreateScreen({ navigation }: Props) {
  const { currentUserId } = useAuth();
  const { members: allMembers } = useOrgData();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const members = allMembers.filter((m) => m.userId !== currentUserId);

  const toggleMember = (userId: string) => {
    setSelectedUserIds((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  };

  const handleCreate = async () => {
    if (!currentUserId) return;
    if (!name.trim()) {
      setError("グループ名を入力してください。");
      return;
    }
    if (selectedUserIds.length === 0) {
      setError("メンバーを1人以上選択してください。");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const room = await chatClient.createRoom({
        isGroup: true,
        name: `${GROUP_NAME_PREFIX}${name}`,
        memberUserIds: [...selectedUserIds, currentUserId],
      });
      navigation.navigate("ChatRoom", { roomId: room.roomId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "グループチャットの作成に失敗しました");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>グループ名</Text>
      <View style={styles.nameRow}>
        <View style={styles.prefixBadge}>
          <Text style={styles.prefixText}>{GROUP_NAME_PREFIX}</Text>
        </View>
        <TextInput
          style={styles.input}
          placeholder="例）3歳児クラス"
          value={name}
          onChangeText={setName}
        />
      </View>
      <Text style={styles.preview}>
        表示名：{GROUP_NAME_PREFIX}
        {name || "（未入力）"}
      </Text>
      <Text style={styles.label}>メンバー個別選択（{selectedUserIds.length}人選択中）</Text>
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
        style={styles.memberList}
        renderItem={({ item }) => (
          <Pressable onPress={() => toggleMember(item.userId)} style={styles.memberRow}>
            <Ionicons
              name={selectedUserIds.includes(item.userId) ? "checkbox-outline" : "square-outline"}
              size={20}
              color={colors.brandDark}
            />
            <Text style={styles.memberName}>{item.displayName}</Text>
          </Pressable>
        )}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.createButton} onPress={handleCreate} disabled={submitting}>
        <Text style={styles.createButtonText}>作成</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  label: { fontWeight: "600", marginTop: 16, marginBottom: 8 },
  nameRow: { flexDirection: "row", alignItems: "center" },
  prefixBadge: {
    backgroundColor: colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  prefixText: { color: colors.textMuted, fontWeight: "700" },
  input: {
    flex: 1,
    backgroundColor: "#F4FFFB",
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    padding: 10,
  },
  preview: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, paddingVertical: 10 },
  memberList: { maxHeight: 260, marginTop: 8 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  memberName: { fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, marginTop: 8 },
  createButton: { marginTop: 24, backgroundColor: colors.brand, borderRadius: 12, padding: 12, alignItems: "center" },
  createButtonText: { fontWeight: "700" },
});
