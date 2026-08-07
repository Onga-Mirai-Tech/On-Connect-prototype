import { useState } from "react";
import { View, Text, TextInput, SectionList, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps, NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { mockChatRooms, memberMatchesQuery } from "@on-connect/shared";
import type { MenuStackParamList, HomeTabParamList, RootStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { chatClient } from "../api/chatClient";
import { callClient } from "../api/callClient";

type Props = NativeStackScreenProps<MenuStackParamList, "Members">;

/**
 * メンバー一覧画面（メニュータブ配下、Phase 4でメニュー画面から遷移する形に変更）
 * 各メンバーの通知ON/OFF状況を確認でき、その場から個別チャット・音声通話を開始できる。
 * 氏名・ふりがな（ひらがな）検索とロール別グループ表示に対応する。
 */
export function MembersScreen({ navigation }: Props) {
  const { currentUserId } = useAuth();
  const { members, roles, memberCategories } = useOrgData();
  const [query, setQuery] = useState("");
  const [creatingUserId, setCreatingUserId] = useState<string | null>(null);
  const [callError, setCallError] = useState<string | null>(null);

  const categoryName = (categoryId: string) =>
    memberCategories.find((c) => c.categoryId === categoryId)?.name ?? "";

  const handleChat = async (memberId: string) => {
    if (!currentUserId) return;
    const tabNavigation = navigation.getParent<BottomTabNavigationProp<HomeTabParamList>>();
    setCreatingUserId(memberId);
    try {
      const rooms = await chatClient.listChatRoomsForUser(currentUserId);
      const existingRoom = rooms.find((r) => !r.isGroup && r.memberUserIds.includes(memberId));
      const roomId = existingRoom
        ? existingRoom.roomId
        : (await chatClient.createRoom({ isGroup: false, memberUserIds: [currentUserId, memberId] })).roomId;
      tabNavigation?.navigate("ChatTab", { screen: "ChatRoom", params: { roomId } });
    } catch {
      const existingRoom = mockChatRooms.find(
        (r) => !r.isGroup && r.memberUserIds.includes(currentUserId) && r.memberUserIds.includes(memberId),
      );
      tabNavigation?.navigate("ChatTab", {
        screen: "ChatRoom",
        params: { roomId: existingRoom?.roomId ?? `dm-${memberId}` },
      });
    } finally {
      setCreatingUserId(null);
    }
  };

  const handleCall = async (memberId: string, memberName: string) => {
    setCallError(null);
    try {
      const result = await callClient.initiateCall(memberId);
      const tabNavigation = navigation.getParent<BottomTabNavigationProp<HomeTabParamList>>();
      const rootNavigation = tabNavigation?.getParent<NativeStackNavigationProp<RootStackParamList>>();
      rootNavigation?.navigate("IncomingCall", {
        role: "caller",
        callId: result.callId,
        calleeId: memberId,
        calleeName: memberName,
        meetingJson: JSON.stringify(result.meeting),
        attendeeJson: JSON.stringify(result.callerAttendee),
        startTime: new Date().toISOString(),
      });
    } catch (err) {
      console.error("発信に失敗しました", err);
      setCallError(err instanceof Error ? err.message : "発信に失敗しました");
    }
  };

  const filteredMembers = members.filter((m) => memberMatchesQuery(m, query));

  // ロール別（rolesの定義順）にグループ化して表示する
  const sections = roles
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
      {callError && <Text style={styles.callErrorText}>{callError}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.userId}
        ListEmptyComponent={<Text>該当するメンバーが見つかりません。</Text>}
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) => {
          const isSelf = item.userId === currentUserId;
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
                  <Pressable
                    onPress={() => handleChat(item.userId)}
                    disabled={creatingUserId === item.userId}
                    style={styles.actionButton}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={colors.brandDark} />
                  </Pressable>
                  <Pressable onPress={() => void handleCall(item.userId, item.displayName)} style={styles.actionButton}>
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
  callErrorText: { fontSize: 12, color: colors.danger, marginBottom: 8 },
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
