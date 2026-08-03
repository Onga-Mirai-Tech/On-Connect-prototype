import { useState } from "react";
import { View, Text, TextInput, SectionList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  mockMembers,
  mockMemberCategories,
  mockRoles,
  mockChatRooms,
  mockCurrentUserId,
  memberMatchesQuery,
} from "@on-connect/shared";
import type { HomeTabParamList, RootStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = BottomTabScreenProps<HomeTabParamList, "Members">;

/**
 * メンバー一覧画面（下部タブ）
 * 各メンバーの通知ON/OFF状況を確認でき、その場から個別チャット・音声通話を開始できる。
 * 氏名・ふりがな（ひらがな）検索とロール別グループ表示に対応する。
 * TODO: GET /users からメンバー一覧を取得する（現状はダミーデータ表示）。
 */
export function MembersScreen({ navigation }: Props) {
  const [query, setQuery] = useState("");

  const categoryName = (categoryId: string) =>
    mockMemberCategories.find((c) => c.categoryId === categoryId)?.name ?? "";

  const handleChat = (memberId: string) => {
    const existingRoom = mockChatRooms.find(
      (r) => !r.isGroup && r.memberUserIds.includes(mockCurrentUserId) && r.memberUserIds.includes(memberId),
    );
    navigation.navigate("ChatTab", {
      screen: "ChatRoom",
      params: { roomId: existingRoom?.roomId ?? `dm-${memberId}` },
    });
  };

  const handleCall = (memberName: string) => {
    // TODO: POST /calls を呼び出しChime SDK Meetingを開始する（現状はデモ用の着信画面へ遷移）
    const parent = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    parent?.navigate("IncomingCall", { callerName: memberName });
  };

  const filteredMembers = mockMembers.filter((m) => memberMatchesQuery(m, query));

  // ロール別（mockRolesの定義順）にグループ化して表示する
  const sections = mockRoles
    .map((role) => ({
      title: role.name,
      data: filteredMembers.filter((m) => m.roleId === role.roleId),
    }))
    .filter((s) => s.data.length > 0);

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
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={<Text>該当するメンバーが見つかりません。</Text>}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const isSelf = item.userId === mockCurrentUserId;
          return (
            <View style={styles.row}>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.displayName}</Text>
                  {isSelf && <Text style={styles.selfTag}>（自分）</Text>}
                  <Ionicons
                    name={item.notificationStatus === "ON" ? "notifications-outline" : "notifications-off-outline"}
                    size={14}
                    color={item.notificationStatus === "ON" ? colors.brandDark : colors.textMuted}
                  />
                </View>
                <Text style={styles.meta}>
                  {categoryName(item.memberCategoryId)}
                  {item.className ? ` ・ ${item.className}` : ""}
                </Text>
              </View>
              {!isSelf && (
                <View style={styles.actions}>
                  <Pressable onPress={() => handleChat(item.userId)} style={styles.actionButton}>
                    <Ionicons name="chatbubble-outline" size={18} color={colors.brandDark} />
                  </Pressable>
                  <Pressable onPress={() => handleCall(item.displayName)} style={styles.actionButton}>
                    <Ionicons name="call-outline" size={18} color={colors.brandDark} />
                  </Pressable>
                </View>
              )}
            </View>
          );
        }}
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
  sectionTitle: { fontSize: 12, color: colors.textMuted, marginTop: 12, marginBottom: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontWeight: "700" },
  selfTag: { fontSize: 12, color: colors.textMuted },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  actions: { flexDirection: "row", gap: 8 },
  actionButton: { padding: 8, borderRadius: 12, backgroundColor: colors.surface },
});
