import { View, Text, Pressable, FlatList, Linking, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mockScheduleCacheEvents, mockOrgLinks } from "@on-connect/shared";
import { colors } from "../theme/colors";

const calendarLink = mockOrgLinks.find((l) => l.category === "カレンダー");

const formatRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const sameDay = start.toDateString() === end.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", weekday: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${start.toLocaleDateString("ja-JP", dateFmt)} ${start.toLocaleTimeString("ja-JP", timeFmt)}〜${end.toLocaleTimeString("ja-JP", timeFmt)}`;
  }
  return `${start.toLocaleDateString("ja-JP", dateFmt)}〜${end.toLocaleDateString("ja-JP", dateFmt)}`;
};

/**
 * カレンダー画面（7章 8番）：Googleカレンダー閲覧専用、今後の予定をリスト形式で表示（5.4）
 * 共有カレンダーの作成・編集はGoogleカレンダー側で行う運用を変えず、アプリ内では
 * 閲覧のみを提供することでメンバーが確認するハードルを下げる。月表示・週表示は設けず、
 * シンプルに「今後の予定」のみをリストで見せる。
 * TODO: GET /calendar/events から取得する（現状はダミーデータ表示）
 */
export function CalendarScreen() {
  const now = Date.now();
  const events = [...mockScheduleCacheEvents]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>今後の予定</Text>
      <Text style={styles.hint}>
        連携カレンダー：園の共有カレンダー（サービスアカウント方式、編集はGoogleカレンダー側で行ってください）
      </Text>
      {calendarLink && (
        <Pressable onPress={() => Linking.openURL(calendarLink.url)} style={styles.linkRow}>
          <Ionicons name="open-outline" size={14} color={colors.brandDark} />
          <Text style={styles.linkText}>Googleカレンダーで開く（詳細確認・編集）</Text>
        </Pressable>
      )}
      <FlatList
        data={events}
        keyExtractor={(item) => item.eventId}
        ListEmptyComponent={<Text>今後の予定はまだありません。</Text>}
        renderItem={({ item }) => (
          <View style={styles.eventRow}>
            <Ionicons name="calendar-outline" size={16} color={colors.brandDark} />
            <View>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventRange}>{formatRange(item.startAt, item.endAt)}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  heading: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  hint: { fontSize: 12, color: colors.textMuted, marginBottom: 4 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  linkText: { fontSize: 13, color: colors.brandDark },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  eventTitle: { fontWeight: "700" },
  eventRange: { fontSize: 12, color: colors.textMuted },
});
