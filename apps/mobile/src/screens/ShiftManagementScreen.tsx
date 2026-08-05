import { useState } from "react";
import { View, Text, Pressable, ScrollView, TextInput, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  mockMembers,
  mockMemberDailyStatuses,
  mockDutyTypes,
  mockShiftTypes,
  mockDailyNotes,
  mockCurrentUserId,
  weekdayLabelForDate,
  holidayNameForDate,
  type MemberDailyStatus,
  type DailyNote,
  type LeaveType,
  type LeaveReason,
} from "@on-connect/shared";
import { colors } from "../theme/colors";

const leaveLabel: Record<LeaveType, string> = { FULL: "休", AM: "午前休", PM: "午後休" };
const leaveReasonLabel: Record<LeaveReason, string> = { REQUESTED: "希望休", ASSIGNED: "指定休" };

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 配列内の値ごとの出現回数を数える */
function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const v of values) counts[v] = (counts[v] ?? 0) + 1;
  return counts;
}

const activeDutyTypes = mockDutyTypes.filter((d) => d.isActive);
const activeShiftTypes = mockShiftTypes.filter((s) => s.isActive);

const CELL_WIDTH = 64;
const SUMMARY_WIDTH = 44;
const NAME_WIDTH = 88;

/**
 * シフト管理画面：休日・当番・シフトを月間グリッド（メンバー×日付）で表示する。
 * 編集はmanageShifts権限を持つ人のみ（本人の分も含め自己申告はできない）。閲覧は全員に開放。
 * ヘッダーに曜日・祝日、日付の下にメモ欄と当番人数の集計、右端にメンバー別の月間当番・シフト回数を表示する。
 * TODO: GET /member-daily-status?date=... / PUT /member-daily-status/{date}/{userId}、
 * GET /daily-notes/{date} / PUT /daily-notes/{date} をAPIに接続する（現状はダミーデータのローカルstateのみ）。
 * 注：名前列は固定表示せず、行全体が横スクロールする簡易実装（Web版は名前列を固定表示）。
 */
export function ShiftManagementScreen() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [statuses, setStatuses] = useState(mockMemberDailyStatuses);
  const [notes, setNotes] = useState(mockDailyNotes);
  const [editing, setEditing] = useState<{ userId: string; date: string } | null>(null);
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);

  const currentUser = mockMembers.find((m) => m.userId === mockCurrentUserId);
  const canEdit = currentUser?.permissions.manageShifts ?? false;

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const monthDates = days.map((d) => dateKey(year, month, d));

  const statusFor = (userId: string, date: string) => statuses.find((s) => s.userId === userId && s.date === date);
  const noteFor = (date: string) => notes.find((n) => n.date === date);
  const shiftName = (id: string | undefined) => mockShiftTypes.find((s) => s.shiftTypeId === id)?.name;
  const dutyName = (id: string) => mockDutyTypes.find((d) => d.dutyTypeId === id)?.name ?? id;

  // 日ごとの当番人数（当番タイプ別）
  const dutyCountsByDate: Record<string, Record<string, number>> = {};
  for (const date of monthDates) {
    const ids = statuses.filter((s) => s.date === date).flatMap((s) => s.dutyTypeIds ?? []);
    dutyCountsByDate[date] = countBy(ids);
  }

  // メンバーごとの月間当番回数・シフト回数（午前午後は別カウント）
  const dutyCountsByMember: Record<string, Record<string, number>> = {};
  const shiftCountsByMember: Record<string, Record<string, number>> = {};
  for (const m of mockMembers) {
    const memberStatuses = statuses.filter((s) => s.userId === m.userId && monthDates.includes(s.date));
    dutyCountsByMember[m.userId] = countBy(memberStatuses.flatMap((s) => s.dutyTypeIds ?? []));
    const shiftIds = memberStatuses.flatMap((s) =>
      [s.amShiftTypeId, s.pmShiftTypeId].filter((id): id is string => !!id),
    );
    shiftCountsByMember[m.userId] = countBy(shiftIds);
  }

  const goPrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };
  const goNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleSave = (userId: string, date: string, patch: Partial<MemberDailyStatus>) => {
    // TODO: PUT /member-daily-status/{date}/{userId} を呼び出す（現状はローカルstateのみ）
    setStatuses((prev) => {
      const idx = prev.findIndex((s) => s.userId === userId && s.date === date);
      const base: MemberDailyStatus = idx >= 0 ? prev[idx] : { date, userId, updatedAt: "", updatedBy: "" };
      const updated: MemberDailyStatus = {
        ...base,
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: mockCurrentUserId,
      };
      const next = [...prev];
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return next;
    });
    setEditing(null);
  };

  const handleClear = (userId: string, date: string) => {
    // TODO: DELETE /member-daily-status/{date}/{userId} を呼び出す
    setStatuses((prev) => prev.filter((s) => !(s.userId === userId && s.date === date)));
    setEditing(null);
  };

  const handleSaveNote = (date: string, note: string) => {
    // TODO: PUT /daily-notes/{date} を呼び出す（現状はローカルstateのみ）
    setNotes((prev) => {
      const idx = prev.findIndex((n) => n.date === date);
      const updated: DailyNote = { date, note, updatedAt: new Date().toISOString(), updatedBy: mockCurrentUserId };
      const next = [...prev];
      if (idx >= 0) next[idx] = updated;
      else next.push(updated);
      return next;
    });
    setEditingNoteDate(null);
  };

  const handleClearNote = (date: string) => {
    // TODO: DELETE /daily-notes/{date} を呼び出す
    setNotes((prev) => prev.filter((n) => n.date !== date));
    setEditingNoteDate(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>シフト管理</Text>
        <View style={styles.monthNav}>
          <Pressable onPress={goPrevMonth}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.monthLabel}>
            {year}年{month}月
          </Text>
          <Pressable onPress={goNextMonth}>
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <Text style={styles.hint}>
        {canEdit ? "セルをタップすると編集できます。" : "閲覧のみです（編集には管理者権限が必要です）。"}
      </Text>
      <ScrollView horizontal>
        <View>
          <View style={styles.row}>
            <View style={[styles.cell, { width: NAME_WIDTH }]} />
            {days.map((d) => {
              const date = dateKey(year, month, d);
              const weekday = weekdayLabelForDate(date);
              const holiday = holidayNameForDate(date);
              const isRedDay = weekday === "日" || !!holiday;
              const isSaturday = weekday === "土";
              return (
                <View
                  key={d}
                  style={[
                    styles.cell,
                    { width: CELL_WIDTH },
                    (isRedDay || isSaturday) && { backgroundColor: colors.surface },
                  ]}
                >
                  <Text style={[styles.headerText, isRedDay && { color: colors.danger, fontWeight: "700" }]}>
                    {d} ({weekday})
                  </Text>
                  {holiday && (
                    <Text style={styles.holidayText} numberOfLines={1}>
                      {holiday}
                    </Text>
                  )}
                </View>
              );
            })}
            {activeDutyTypes.map((d) => (
              <View key={d.dutyTypeId} style={[styles.cell, styles.summaryCell, { width: SUMMARY_WIDTH }]}>
                <Text style={styles.summaryHeaderLabel}>当番</Text>
                <Text style={styles.headerText} numberOfLines={1}>
                  {d.name}
                </Text>
              </View>
            ))}
            {activeShiftTypes.map((s) => (
              <View key={s.shiftTypeId} style={[styles.cell, { width: SUMMARY_WIDTH }]}>
                <Text style={styles.summaryHeaderLabel}>シフト</Text>
                <Text style={styles.headerText} numberOfLines={1}>
                  {s.name}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { width: NAME_WIDTH }]}>
              <Text style={styles.nameText}>メモ</Text>
            </View>
            {days.map((d) => {
              const date = dateKey(year, month, d);
              const note = noteFor(date);
              return (
                <Pressable
                  key={d}
                  onPress={() => canEdit && setEditingNoteDate(date)}
                  style={[styles.cell, { width: CELL_WIDTH }]}
                >
                  <Text style={styles.noteText} numberOfLines={3}>
                    {note?.note}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.row}>
            <View style={[styles.cell, { width: NAME_WIDTH }]}>
              <Text style={styles.nameText}>当番人数</Text>
            </View>
            {days.map((d) => {
              const date = dateKey(year, month, d);
              const counts = Object.entries(dutyCountsByDate[date] ?? {});
              return (
                <View key={d} style={[styles.cell, { width: CELL_WIDTH }]}>
                  {counts.map(([id, count]) => (
                    <Text key={id} style={styles.dutyText}>
                      {dutyName(id)}:{count}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>

          <ScrollView>
            {mockMembers.map((m) => (
              <View key={m.userId} style={styles.row}>
                <View style={[styles.cell, { width: NAME_WIDTH }]}>
                  <Text style={styles.nameText} numberOfLines={1}>
                    {m.displayName}
                  </Text>
                </View>
                {days.map((d) => {
                  const date = dateKey(year, month, d);
                  const status = statusFor(m.userId, date);
                  return (
                    <Pressable
                      key={d}
                      onPress={() => canEdit && setEditing({ userId: m.userId, date })}
                      style={[styles.cell, { width: CELL_WIDTH }]}
                    >
                      {status?.leaveType && <Text style={styles.leaveText}>{leaveLabel[status.leaveType]}</Text>}
                      {status?.amShiftTypeId && (
                        <Text style={styles.cellText}>
                          {status.amShiftTypeId === status.pmShiftTypeId ? "" : "AM:"}
                          {shiftName(status.amShiftTypeId)}
                        </Text>
                      )}
                      {status?.pmShiftTypeId && status.pmShiftTypeId !== status.amShiftTypeId && (
                        <Text style={styles.cellText}>PM:{shiftName(status.pmShiftTypeId)}</Text>
                      )}
                      {status?.dutyTypeIds?.map((id) => (
                        <Text key={id} style={styles.dutyText}>
                          {dutyName(id)}
                        </Text>
                      ))}
                    </Pressable>
                  );
                })}
                {activeDutyTypes.map((d) => (
                  <View key={d.dutyTypeId} style={[styles.cell, styles.summaryCell, { width: SUMMARY_WIDTH }]}>
                    <Text style={styles.summaryValue}>{dutyCountsByMember[m.userId]?.[d.dutyTypeId] || ""}</Text>
                  </View>
                ))}
                {activeShiftTypes.map((s) => (
                  <View key={s.shiftTypeId} style={[styles.cell, { width: SUMMARY_WIDTH }]}>
                    <Text style={styles.summaryValue}>{shiftCountsByMember[m.userId]?.[s.shiftTypeId] || ""}</Text>
                  </View>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {editing && (
        <EditPanel
          memberName={mockMembers.find((m) => m.userId === editing.userId)?.displayName}
          date={editing.date}
          status={statusFor(editing.userId, editing.date)}
          onSave={(patch) => handleSave(editing.userId, editing.date, patch)}
          onClear={() => handleClear(editing.userId, editing.date)}
          onClose={() => setEditing(null)}
        />
      )}

      {editingNoteDate && (
        <NoteEditPanel
          date={editingNoteDate}
          note={noteFor(editingNoteDate)}
          onSave={(note) => handleSaveNote(editingNoteDate, note)}
          onClear={() => handleClearNote(editingNoteDate)}
          onClose={() => setEditingNoteDate(null)}
        />
      )}
    </View>
  );
}

function NoteEditPanel({
  date,
  note,
  onSave,
  onClear,
  onClose,
}: {
  date: string;
  note: DailyNote | undefined;
  onSave: (note: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(note?.note ?? "");

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{date} のメモ</Text>
        <Pressable onPress={onClose}>
          <Text>閉じる</Text>
        </Pressable>
      </View>
      <TextInput
        value={value}
        onChangeText={setValue}
        multiline
        numberOfLines={3}
        placeholder="この日全体に関する備考（例：避難訓練あり）"
        style={styles.noteInput}
      />
      <View style={styles.panelActions}>
        <Pressable style={styles.saveButton} onPress={() => onSave(value)}>
          <Text style={styles.saveButtonText}>保存</Text>
        </Pressable>
        <Pressable style={styles.clearButton} onPress={onClear}>
          <Text>このメモを削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

function EditPanel({
  memberName,
  date,
  status,
  onSave,
  onClear,
  onClose,
}: {
  memberName: string | undefined;
  date: string;
  status: MemberDailyStatus | undefined;
  onSave: (patch: Partial<MemberDailyStatus>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const leaveOptions: (LeaveType | "")[] = ["", "FULL", "AM", "PM"];
  const [leaveType, setLeaveType] = useState<LeaveType | "">(status?.leaveType ?? "");
  const [leaveReason, setLeaveReason] = useState<LeaveReason>(status?.leaveReason ?? "ASSIGNED");
  const [amShiftTypeId, setAmShiftTypeId] = useState(status?.amShiftTypeId ?? "");
  const [pmShiftTypeId, setPmShiftTypeId] = useState(status?.pmShiftTypeId ?? "");
  const [dutyTypeIds, setDutyTypeIds] = useState<string[]>(status?.dutyTypeIds ?? []);

  const toggleDuty = (id: string) => {
    setDutyTypeIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>
          {memberName} ・ {date}
        </Text>
        <Pressable onPress={onClose}>
          <Text>閉じる</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>休日</Text>
      <View style={styles.chipRow}>
        {leaveOptions.map((opt) => (
          <Pressable
            key={opt || "none"}
            onPress={() => setLeaveType(opt)}
            style={[styles.chip, leaveType === opt && styles.chipActive]}
          >
            <Text>{opt ? leaveLabel[opt] : "なし"}</Text>
          </Pressable>
        ))}
      </View>
      {leaveType && (
        <>
          <Text style={styles.label}>区分</Text>
          <View style={styles.chipRow}>
            {(["REQUESTED", "ASSIGNED"] as LeaveReason[]).map((r) => (
              <Pressable
                key={r}
                onPress={() => setLeaveReason(r)}
                style={[styles.chip, leaveReason === r && styles.chipActive]}
              >
                <Text>{leaveReasonLabel[r]}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      <Text style={styles.label}>午前のシフト</Text>
      <View style={styles.chipRow}>
        <Pressable onPress={() => setAmShiftTypeId("")} style={[styles.chip, amShiftTypeId === "" && styles.chipActive]}>
          <Text>なし</Text>
        </Pressable>
        {mockShiftTypes
          .filter((s) => s.isActive || s.shiftTypeId === amShiftTypeId)
          .map((s) => (
            <Pressable
              key={s.shiftTypeId}
              onPress={() => setAmShiftTypeId(s.shiftTypeId)}
              style={[styles.chip, amShiftTypeId === s.shiftTypeId && styles.chipActive]}
            >
              <Text>{s.name}</Text>
            </Pressable>
          ))}
      </View>
      <Text style={styles.label}>午後のシフト</Text>
      <View style={styles.chipRow}>
        <Pressable onPress={() => setPmShiftTypeId("")} style={[styles.chip, pmShiftTypeId === "" && styles.chipActive]}>
          <Text>なし</Text>
        </Pressable>
        {mockShiftTypes
          .filter((s) => s.isActive || s.shiftTypeId === pmShiftTypeId)
          .map((s) => (
            <Pressable
              key={s.shiftTypeId}
              onPress={() => setPmShiftTypeId(s.shiftTypeId)}
              style={[styles.chip, pmShiftTypeId === s.shiftTypeId && styles.chipActive]}
            >
              <Text>{s.name}</Text>
            </Pressable>
          ))}
        <Pressable onPress={() => setPmShiftTypeId(amShiftTypeId)} style={styles.chip}>
          <Text>午前と同じ</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>当番（複数可）</Text>
      <View style={styles.chipRow}>
        {mockDutyTypes
          .filter((d) => d.isActive || dutyTypeIds.includes(d.dutyTypeId))
          .map((d) => (
            <Pressable
              key={d.dutyTypeId}
              onPress={() => toggleDuty(d.dutyTypeId)}
              style={[styles.chip, dutyTypeIds.includes(d.dutyTypeId) && styles.chipActive]}
            >
              <Text>{d.name}</Text>
            </Pressable>
          ))}
      </View>
      <View style={styles.panelActions}>
        <Pressable
          style={styles.saveButton}
          onPress={() =>
            onSave({
              leaveType: leaveType || undefined,
              leaveReason: leaveType ? leaveReason : undefined,
              amShiftTypeId: amShiftTypeId || undefined,
              pmShiftTypeId: pmShiftTypeId || undefined,
              dutyTypeIds: dutyTypeIds.length > 0 ? dutyTypeIds : undefined,
            })
          }
        >
          <Text style={styles.saveButtonText}>保存</Text>
        </Pressable>
        <Pressable style={styles.clearButton} onPress={onClear}>
          <Text>この日の記録を削除</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heading: { fontSize: 20, fontWeight: "700" },
  monthNav: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthLabel: { fontWeight: "700" },
  hint: { fontSize: 12, color: colors.textMuted, marginVertical: 8 },
  row: { flexDirection: "row" },
  cell: {
    minHeight: 44,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.surface,
    justifyContent: "flex-start",
  },
  summaryCell: { borderLeftWidth: 2 },
  headerText: { fontSize: 11, color: colors.textMuted, textAlign: "center" },
  holidayText: { fontSize: 8, color: colors.danger, textAlign: "center" },
  summaryHeaderLabel: { fontSize: 8, color: colors.textMuted, textAlign: "center" },
  summaryValue: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  nameText: { fontWeight: "700", fontSize: 12 },
  cellText: { fontSize: 10 },
  leaveText: { fontSize: 10, fontWeight: "700", color: colors.danger },
  dutyText: { fontSize: 10, color: colors.brandDark },
  noteText: { fontSize: 10 },
  noteInput: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.surface,
    borderRadius: 8,
    padding: 8,
    minHeight: 72,
    textAlignVertical: "top",
  },
  panel: { marginTop: 16, borderWidth: 1, borderColor: colors.surface, borderRadius: 14, padding: 16 },
  panelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  panelTitle: { fontWeight: "700" },
  label: { fontWeight: "600", marginTop: 12, marginBottom: 4 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.brand },
  panelActions: { flexDirection: "row", gap: 12, marginTop: 16 },
  saveButton: { backgroundColor: colors.brand, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  saveButtonText: { fontWeight: "700" },
  clearButton: { paddingVertical: 10, paddingHorizontal: 16 },
});
