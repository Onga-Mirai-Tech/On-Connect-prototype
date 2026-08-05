import { useState } from "react";
import { View, Text, Pressable, FlatList, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  mockCalendarEvents,
  mockCalendarCategories,
  weekdayLabelForDate,
  holidayNameForDate,
  toDateKey,
  parseDateKey,
  addDays,
  addMonths,
  buildMonthGrid,
  buildWeekDays,
  eventsOnDate,
  type CalendarEvent,
} from "@on-connect/shared";
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

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });

const formatWeekLabel = (anchorKey: string) => {
  const days = buildWeekDays(anchorKey);
  const fmt: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric" };
  return `${parseDateKey(days[0]).toLocaleDateString("ja-JP", fmt)}〜${parseDateKey(days[6]).toLocaleDateString("ja-JP", fmt)}`;
};

type ViewMode = "month" | "week" | "list";
const viewModeLabels: Record<ViewMode, string> = { month: "月", week: "週", list: "リスト" };

/**
 * カレンダー画面（7章 8番）：独立DB管理の共有カレンダー（Googleカレンダーとは同期しない）。
 * 全メンバーが予定を作成・編集できる。月表示・週表示・リスト表示の3モードに対応する。
 * TODO: GET /calendar-events から一覧を取得する（現状はダミーデータ表示）
 */
export function CalendarScreen({ navigation }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [refDate, setRefDate] = useState(() => toDateKey(new Date()));
  const todayKey = toDateKey(new Date());

  const goPrev = () => setRefDate((d) => (viewMode === "week" ? addDays(d, -7) : addMonths(d, -1)));
  const goNext = () => setRefDate((d) => (viewMode === "week" ? addDays(d, 7) : addMonths(d, 1)));
  const goToWeek = (dateKey: string) => {
    setRefDate(dateKey);
    setViewMode("week");
  };
  const goToDetail = (eventId: string) => navigation.navigate("CalendarDetail", { eventId });

  const refDateObj = parseDateKey(refDate);
  const year = refDateObj.getFullYear();
  const month = refDateObj.getMonth() + 1;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>カレンダー</Text>
        <Pressable onPress={() => navigation.navigate("CalendarEventEdit", {})}>
          <Text style={styles.newEvent}>＋ 予定を追加</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        {(Object.keys(viewModeLabels) as ViewMode[]).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => setViewMode(mode)}
            style={[styles.toggleButton, viewMode === mode && styles.toggleButtonActive]}
          >
            <Text style={[styles.toggleText, viewMode === mode && styles.toggleTextActive]}>{viewModeLabels[mode]}</Text>
          </Pressable>
        ))}
      </View>

      {viewMode !== "list" && (
        <View style={styles.navRow}>
          <Pressable onPress={goPrev}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.navLabel}>{viewMode === "month" ? `${year}年${month}月` : formatWeekLabel(refDate)}</Text>
          <Pressable onPress={goNext}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      )}

      {viewMode === "month" && (
        <ScrollView style={styles.flexFill}>
          <MonthGrid year={year} month={month} events={mockCalendarEvents} todayKey={todayKey} onSelectDay={goToWeek} />
        </ScrollView>
      )}
      {viewMode === "week" && (
        <ScrollView style={styles.flexFill}>
          <WeekAgenda anchorKey={refDate} events={mockCalendarEvents} todayKey={todayKey} onSelectEvent={goToDetail} />
        </ScrollView>
      )}
      {viewMode === "list" && <ListView events={mockCalendarEvents} onSelectEvent={goToDetail} />}
    </View>
  );
}

function MonthGrid({
  year,
  month,
  events,
  todayKey,
  onSelectDay,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  todayKey: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const weeks = buildMonthGrid(year, month);
  const weekdayHeaders = ["月", "火", "水", "木", "金", "土", "日"];

  return (
    <View>
      <View style={styles.weekdayHeaderRow}>
        {weekdayHeaders.map((w, i) => (
          <Text
            key={w}
            style={[styles.weekdayHeaderText, i === 5 && { color: colors.brandDark }, i === 6 && { color: colors.danger }]}
          >
            {w}
          </Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.gridRow}>
          {week.map((cell) => {
            const dayEvents = eventsOnDate(events, cell.dateKey);
            const day = parseDateKey(cell.dateKey);
            const weekday = weekdayLabelForDate(cell.dateKey);
            const holiday = holidayNameForDate(cell.dateKey);
            const isRedDay = weekday === "日" || !!holiday;
            const isSaturday = weekday === "土";
            const isToday = cell.dateKey === todayKey;
            const dotCount = Math.min(dayEvents.length, 3);

            return (
              <Pressable
                key={cell.dateKey}
                onPress={() => onSelectDay(cell.dateKey)}
                style={[styles.monthCell, isToday && styles.monthCellToday, !cell.inCurrentMonth && styles.monthCellFaded]}
              >
                <Text style={[styles.monthCellText, isRedDay && { color: colors.danger }, isSaturday && { color: colors.brandDark }]}>
                  {day.getDate()}
                </Text>
                <View style={styles.dotsRow}>
                  {Array.from({ length: dotCount }).map((_, i) => (
                    <View key={i} style={styles.dot} />
                  ))}
                  {dayEvents.length > 3 && <Text style={styles.dotOverflow}>+</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function WeekAgenda({
  anchorKey,
  events,
  todayKey,
  onSelectEvent,
}: {
  anchorKey: string;
  events: CalendarEvent[];
  todayKey: string;
  onSelectEvent: (eventId: string) => void;
}) {
  const days = buildWeekDays(anchorKey);

  return (
    <View>
      {days.map((dateKey) => {
        const dayEvents = eventsOnDate(events, dateKey).sort((a, b) => a.startAt.localeCompare(b.startAt));
        const day = parseDateKey(dateKey);
        const weekday = weekdayLabelForDate(dateKey);
        const holiday = holidayNameForDate(dateKey);
        const isRedDay = weekday === "日" || !!holiday;
        const isSaturday = weekday === "土";
        const isToday = dateKey === todayKey;

        return (
          <View key={dateKey} style={styles.agendaSection}>
            <View style={[styles.agendaHeaderRow, isToday && styles.agendaHeaderToday]}>
              <Text style={[styles.agendaHeaderText, isRedDay && { color: colors.danger }, isSaturday && { color: colors.brandDark }]}>
                {day.getMonth() + 1}/{day.getDate()}（{weekday}）
              </Text>
              {holiday && <Text style={styles.agendaHoliday}>{holiday}</Text>}
            </View>
            {dayEvents.length === 0 ? (
              <Text style={styles.agendaEmpty}>予定なし</Text>
            ) : (
              dayEvents.map((e) => (
                <Pressable key={e.eventId} onPress={() => onSelectEvent(e.eventId)} style={styles.agendaEventRow}>
                  <Ionicons name="calendar-outline" size={14} color={colors.brandDark} />
                  <View>
                    <Text style={styles.agendaEventTitle}>{e.title}</Text>
                    <Text style={styles.agendaEventTime}>
                      {formatTime(e.startAt)}〜{formatTime(e.endAt)}
                    </Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        );
      })}
    </View>
  );
}

function ListView({ events, onSelectEvent }: { events: CalendarEvent[]; onSelectEvent: (eventId: string) => void }) {
  const now = Date.now();
  const upcoming = [...events]
    .filter((e) => new Date(e.endAt).getTime() >= now)
    .sort((a, b) => a.startAt.localeCompare(b.startAt));

  return (
    <FlatList
      style={styles.flexFill}
      data={upcoming}
      keyExtractor={(item) => item.eventId}
      ListEmptyComponent={<Text>今後の予定はまだありません。</Text>}
      renderItem={({ item }) => (
        <Pressable onPress={() => onSelectEvent(item.eventId)} style={styles.eventRow}>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  flexFill: { flex: 1 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  heading: { fontSize: 20, fontWeight: "700" },
  newEvent: { fontWeight: "600" },

  toggleRow: { flexDirection: "row", gap: 6, marginBottom: 8 },
  toggleButton: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.surface },
  toggleButtonActive: { backgroundColor: colors.brand },
  toggleText: { fontSize: 13 },
  toggleTextActive: { fontWeight: "700" },

  navRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  navLabel: { fontWeight: "700", minWidth: 90, textAlign: "center" },

  weekdayHeaderRow: { flexDirection: "row" },
  weekdayHeaderText: { width: `${100 / 7}%`, textAlign: "center", fontSize: 11, color: colors.textMuted },

  gridRow: { flexDirection: "row" },
  monthCell: {
    width: `${100 / 7}%`,
    minHeight: 48,
    alignItems: "center",
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  monthCellToday: { borderColor: colors.brandDark, borderWidth: 2 },
  monthCellFaded: { opacity: 0.4 },
  monthCellText: { fontSize: 12 },
  dotsRow: { flexDirection: "row", gap: 2, marginTop: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.brandDark },
  dotOverflow: { fontSize: 10, color: colors.textMuted },

  agendaSection: { marginBottom: 12 },
  agendaHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  agendaHeaderToday: { borderBottomColor: colors.brandDark, borderBottomWidth: 2 },
  agendaHeaderText: { fontWeight: "700", fontSize: 13 },
  agendaHoliday: { fontSize: 11, color: colors.danger },
  agendaEmpty: { fontSize: 12, color: colors.textMuted, paddingVertical: 4 },
  agendaEventRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  agendaEventTitle: { fontWeight: "700", fontSize: 13 },
  agendaEventTime: { fontSize: 11, color: colors.textMuted },

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
