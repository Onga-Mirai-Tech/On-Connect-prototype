import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mockMembers, mockCurrentUserId } from "@on-connect/shared";
import { useNotificationStatus } from "../context/NotificationStatusContext";
import { colors } from "../theme/colors";

const currentMember = mockMembers.find((m) => m.userId === mockCurrentUserId);

/**
 * ヘッダー左側に表示する「ログイン中メンバー名＋通知ON/OFF状態」。
 * 各Navigatorのheader/headerLeftとして使う。
 */
export function HeaderStatus() {
  const { status } = useNotificationStatus();

  return (
    <View style={styles.container}>
      <Text style={styles.name}>{currentMember?.displayName ?? "ゲスト"}</Text>
      {status === "ON" ? (
        <View style={styles.badge}>
          <Ionicons name="notifications-outline" size={12} color={colors.brandDark} />
          <Text style={[styles.badgeText, { color: colors.brandDark }]}>通知ON</Text>
        </View>
      ) : (
        <View style={styles.badge}>
          <Ionicons name="notifications-off-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.badgeText, { color: colors.textMuted }]}>通知OFF</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 12 },
  name: { fontWeight: "700", fontSize: 14 },
  badge: { flexDirection: "row", alignItems: "center", gap: 2 },
  badgeText: { fontSize: 11 },
});
