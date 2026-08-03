import { View, Text, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useNotificationStatus } from "../context/NotificationStatusContext";

/** 個人設定画面（7章 10番）：通知ON/OFF切り替え（5.1.2、「つながらない権利」の中核機能） */
export function SettingsScreen() {
  const { status, setStatus } = useNotificationStatus();

  const toggle = (value: boolean) => {
    setStatus(value ? "ON" : "OFF");
    // TODO: PUT /users/{userId} で notificationStatus を更新する
  };

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.labelRow}>
          <Ionicons
            name={status === "ON" ? "notifications-outline" : "notifications-off-outline"}
            size={20}
            color={status === "ON" ? colors.brandDark : colors.textMuted}
          />
          <Text style={styles.label}>通知</Text>
        </View>
        <Switch value={status === "ON"} onValueChange={toggle} />
      </View>
      <Text style={styles.hint}>
        通知オフ中は、緊急連絡フラグ付きメッセージを除き通知は届きません。
        音声通話の着信通知は例外なく届きません。
        毎朝7時（Asia/Tokyo）に自動的に通知オンへリセットされます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 16, fontWeight: "600" },
  hint: { marginTop: 12, color: "#6B7280", fontSize: 12 },
});
