import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "IncomingCall">;

/**
 * 着信画面（7章 5番）：音声通話着信時のフルスクリーン表示。
 * 通知オフのユーザーには例外なく届かない（5.2.4）ため、本画面はプッシュ通知経由の
 * ディープリンク、またはアプリ起動中のAppSyncリアルタイム通知を受けて表示される想定。
 * ネイティブCallKit/ConnectionService連携は次フェーズで検討（docs/DESIGN.md 5.2.4 / 11章）。
 */
export function IncomingCallScreen({ route, navigation }: Props) {
  const { callerName } = route.params;

  const handleAccept = () => {
    // TODO: Chime SDK Meetingへ参加する
    navigation.goBack();
  };

  const handleDecline = () => {
    // TODO: CallLogsにdeclinedとして記録する
    navigation.goBack();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>着信中...</Text>
      <Text style={styles.callerName}>{callerName}</Text>
      <View style={styles.actions}>
        <Pressable style={[styles.circle, { backgroundColor: colors.danger }]} onPress={handleDecline}>
          <Ionicons name="call-outline" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
        </Pressable>
        <Pressable style={[styles.circle, { backgroundColor: colors.brand }]} onPress={handleAccept}>
          <Ionicons name="call-outline" size={28} color="#1A1A1A" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1A1A",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  subtitle: { color: "#fff", fontSize: 14 },
  callerName: { color: "#fff", fontSize: 28, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 32 },
  circle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  circleText: { fontWeight: "700" },
});
