import { View, Text, Pressable, FlatList, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockCalendarEvents, mockCalendarCategories } from "@on-connect/shared";
import type { CalendarStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<CalendarStackParamList, "CalendarList">;

const categoryName = (categoryId: string | undefined) =>
  mockCalendarCategories.find((c) => c.categoryId === categoryId)?.name;

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
 * カレンダー画面（7章 8番）：独立DB管理の共有カレンダー（Googleカレンダーとは同期しない）。
 * 全メンバーが予定を作成・編集できる。月表示・週表示は設けず、今後の予定をリスト形式で見せる。
 * TODO: GET /calendar-events から一覧を取得する（現状はダミーデータ表示）
 */
export function CalendarScreen({ navigation }: Props) {
  const now = Date.now();
  const events = [...mockCalendarEvents]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>今後の予定</Text>
        <Pressable onPress={() => navigation.navigate("CalendarEventEdit", {})}>
          <Text style={styles.newEvent}>＋ 予定を追加</Text>
        </Pressable>
      </View>
      <FlatList
        data={events}
        keyExtractor={(item) => item.eventId}
        ListEmptyComponent={<Text>今後の予定はまだありません。</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("CalendarDetail", { eventId: item.eventId })}
            style={styles.eventRow}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.brandDark} />
            <View>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <Text style={styles.eventRange}>
                {formatRange(item.startAt, item.endAt)}
                {categoryName(item.categoryId) ? `・${categoryName(item.categoryId)}` : ""}
                {item.visibleCategoryIds.length > 0 ? "・公開範囲限定" : ""}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  heading: { fontSize: 20, fontWeight: "700" },
  newEvent: { fontWeight: "600" },
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
