import { useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { mockCalendarEvents, mockCalendarCategories, mockMembers, mockCurrentUserId } from "@on-connect/shared";
import type { CalendarStackParamList } from "../navigation/AppNavigator";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<CalendarStackParamList, "CalendarDetail">;

const categoryName = (categoryId: string | undefined) =>
  mockCalendarCategories.find((c) => c.categoryId === categoryId)?.name;
const memberName = (userId: string) => mockMembers.find((m) => m.userId === userId)?.displayName ?? userId;

const formatRange = (startAt: string, endAt: string) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const dateFmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", weekday: "short" };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  return `${start.toLocaleDateString("ja-JP", dateFmt)} ${start.toLocaleTimeString("ja-JP", timeFmt)}〜${end.toLocaleTimeString("ja-JP", timeFmt)}`;
};

/**
 * カレンダー予定の詳細画面。全メンバーが編集・削除できるが、誤操作防止のため削除前に確認ダイアログを出す
 * （自分が作成した予定でない場合は、その旨を強調して警告する）。
 * TODO: GET/DELETE /calendar-events/{eventId} をAPIに接続する（現状はダミーデータ表示）
 */
export function CalendarDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const [event] = useState(() => mockCalendarEvents.find((e) => e.eventId === eventId));

  if (!event) {
    return (
      <View style={styles.container}>
        <Text>予定が見つかりません。</Text>
      </View>
    );
  }

  const isOwnEvent = event.authorId === mockCurrentUserId;

  const handleDelete = () => {
    Alert.alert(
      "確認",
      isOwnEvent
        ? "この予定を削除しますか？"
        : `この予定は${memberName(event.authorId)}さんが作成したものです。本当に削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: () => {
            // TODO: DELETE /calendar-events/{eventId} を呼び出す
            navigation.navigate("CalendarList");
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{event.title}</Text>
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate("CalendarEventEdit", { eventId: event.eventId })}
            style={styles.actionButton}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.text} />
            <Text>編集</Text>
          </Pressable>
          <Pressable onPress={handleDelete} style={styles.actionButton}>
            <Ionicons name="trash-outline" size={14} color={colors.danger} />
            <Text style={{ color: colors.danger }}>削除</Text>
          </Pressable>
        </View>
      </View>
      <Text style={styles.metaText}>
        {formatRange(event.startAt, event.endAt)}
        {categoryName(event.categoryId) ? `・${categoryName(event.categoryId)}` : ""}
        {event.visibleCategoryIds.length > 0 ? "・公開範囲限定" : ""}
      </Text>
      <Text style={styles.author}>作成者：{memberName(event.authorId)}</Text>
      {event.description && <Text style={styles.description}>{event.description}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "700", flexShrink: 1 },
  actions: { flexDirection: "row", gap: 12 },
  actionButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 12, color: colors.textMuted, marginTop: 8 },
  author: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  description: { backgroundColor: colors.surface, borderRadius: 14, padding: 16 },
});
