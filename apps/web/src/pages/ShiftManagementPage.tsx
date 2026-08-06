import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  mockMemberDailyStatuses,
  mockDailyNotes,
  weekdayLabelForDate,
  holidayNameForDate,
  type DutyType,
  type ShiftType,
  type MemberDailyStatus,
  type DailyNote,
  type LeaveType,
  type LeaveReason,
} from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

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

/**
 * シフト管理画面：休日・当番・シフトを月間グリッド（メンバー×日付）で表示する。
 * 編集はmanageShifts権限を持つ人のみ（本人の分も含め自己申告はできない）。閲覧は全員に開放。
 * ヘッダーに曜日・祝日、日付の下にメモ欄と当番人数の集計、右端にメンバー別の月間当番・シフト回数を表示する。
 * Phase 8c：GET /member-daily-status?date=... / GET /daily-notes/{date} をAPIに接続。
 * 両エンドポイントとも1日単位のみ対応のため、月表示のたびに日付ごとにループしてリクエストする。
 */
export function ShiftManagementPage() {
  const { currentUser } = useAuth();
  const { members, dutyTypes, shiftTypes } = useOrgData();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [statuses, setStatuses] = useState<MemberDailyStatus[]>(mockMemberDailyStatuses);
  const [notes, setNotes] = useState<DailyNote[]>(mockDailyNotes);
  const [editing, setEditing] = useState<{ userId: string; date: string } | null>(null);
  const [editingNoteDate, setEditingNoteDate] = useState<string | null>(null);

  const canEdit = currentUser?.permissions.manageShifts ?? false;

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);
  const monthDates = days.map((d) => dateKey(year, month, d));

  const refetchMonth = async (dates: string[]) => {
    try {
      const statusLists = await Promise.all(dates.map((date) => orgApi.listMemberDailyStatusesForDate(date)));
      const noteList = await Promise.all(dates.map((date) => orgApi.getDailyNote(date)));
      setStatuses(statusLists.flat());
      setNotes(noteList.filter((n) => n.note));
    } catch {
      setStatuses(mockMemberDailyStatuses);
      setNotes(mockDailyNotes);
    }
  };

  useEffect(() => {
    refetchMonth(monthDates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const activeDutyTypes = dutyTypes.filter((d) => d.isActive);
  const activeShiftTypes = shiftTypes.filter((s) => s.isActive);

  const statusFor = (userId: string, date: string) => statuses.find((s) => s.userId === userId && s.date === date);
  const noteFor = (date: string) => notes.find((n) => n.date === date);
  const shiftName = (id: string | undefined) => shiftTypes.find((s) => s.shiftTypeId === id)?.name;
  const dutyName = (id: string) => dutyTypes.find((d) => d.dutyTypeId === id)?.name ?? id;

  // 日ごとの当番人数（当番タイプ別）
  const dutyCountsByDate: Record<string, Record<string, number>> = {};
  for (const date of monthDates) {
    const ids = statuses.filter((s) => s.date === date).flatMap((s) => s.dutyTypeIds ?? []);
    dutyCountsByDate[date] = countBy(ids);
  }

  // メンバーごとの月間当番回数・シフト回数（午前午後は別カウント）
  const dutyCountsByMember: Record<string, Record<string, number>> = {};
  const shiftCountsByMember: Record<string, Record<string, number>> = {};
  for (const m of members) {
    const memberStatuses = statuses.filter((s) => s.userId === m.userId && monthDates.includes(s.date));
    dutyCountsByMember[m.userId] = countBy(memberStatuses.flatMap((s) => s.dutyTypeIds ?? []));
    const shiftIds = memberStatuses.flatMap((s) =>
      [s.amShiftTypeId, s.pmShiftTypeId].filter((id): id is string => !!id),
    );
    shiftCountsByMember[m.userId] = countBy(shiftIds);
  }

  const summaryColumnCount = activeDutyTypes.length + activeShiftTypes.length;

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

  const handleSave = async (userId: string, date: string, patch: Partial<MemberDailyStatus>) => {
    await orgApi.updateMemberDailyStatus(date, userId, patch);
    await refetchMonth(monthDates);
    setEditing(null);
  };

  const handleClear = async (userId: string, date: string) => {
    await orgApi.deleteMemberDailyStatus(date, userId);
    await refetchMonth(monthDates);
    setEditing(null);
  };

  const handleSaveNote = async (date: string, note: string) => {
    await orgApi.updateDailyNote(date, note);
    await refetchMonth(monthDates);
    setEditingNoteDate(null);
  };

  const handleClearNote = async (date: string) => {
    await orgApi.deleteDailyNote(date);
    await refetchMonth(monthDates);
    setEditingNoteDate(null);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>シフト管理</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={goPrevMonth} aria-label="前の月">
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontWeight: 700 }}>
            {year}年{month}月
          </span>
          <button onClick={goNextMonth} aria-label="次の月">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
      <p style={{ fontSize: 12, color: colors.textMuted }}>
        {canEdit
          ? "セルをタップすると休日・当番・シフトを編集できます。メモ欄も編集できます。"
          : "閲覧のみです（編集には管理者権限が必要です）。"}
      </p>
      <div style={{ overflowX: "auto", border: `1px solid ${colors.surface}`, borderRadius: 14 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  background: colors.background,
                  padding: 6,
                  textAlign: "left",
                  zIndex: 1,
                }}
              >
                氏名
              </th>
              {days.map((d) => {
                const date = dateKey(year, month, d);
                const weekday = weekdayLabelForDate(date);
                const holiday = holidayNameForDate(date);
                const isRedDay = weekday === "日" || !!holiday;
                const isSaturday = weekday === "土";
                return (
                  <th
                    key={d}
                    style={{
                      minWidth: 60,
                      padding: 4,
                      color: isRedDay ? colors.danger : isSaturday ? colors.brandDark : colors.textMuted,
                      background: isRedDay || isSaturday ? colors.surface : undefined,
                    }}
                    title={holiday}
                  >
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{d}</div>
                    <div style={{ fontSize: 10 }}>{weekday}</div>
                    {holiday && (
                      <div style={{ fontSize: 8, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {holiday}
                      </div>
                    )}
                  </th>
                );
              })}
              {activeDutyTypes.map((d) => (
                <th key={d.dutyTypeId} style={{ minWidth: 50, padding: 4, borderLeft: `2px solid ${colors.surface}` }}>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>当番</div>
                  <div>{d.name}</div>
                </th>
              ))}
              {activeShiftTypes.map((s) => (
                <th key={s.shiftTypeId} style={{ minWidth: 50, padding: 4 }}>
                  <div style={{ fontSize: 9, color: colors.textMuted }}>シフト</div>
                  <div>{s.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: colors.background,
                  padding: 6,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  borderTop: `1px solid ${colors.surface}`,
                }}
              >
                メモ
              </td>
              {days.map((d) => {
                const date = dateKey(year, month, d);
                const note = noteFor(date);
                const isEditingThis = editingNoteDate === date;
                return (
                  <td
                    key={d}
                    onClick={() => canEdit && setEditingNoteDate(isEditingThis ? null : date)}
                    style={{
                      border: `1px solid ${colors.surface}`,
                      padding: 4,
                      verticalAlign: "top",
                      cursor: canEdit ? "pointer" : "default",
                      background: isEditingThis ? colors.surface : undefined,
                      minWidth: 60,
                      fontSize: 10,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {note?.note}
                  </td>
                );
              })}
              <td colSpan={summaryColumnCount} style={{ borderTop: `1px solid ${colors.surface}` }} />
            </tr>
            <tr>
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: colors.background,
                  padding: 6,
                  fontWeight: 700,
                  whiteSpace: "nowrap",
                  borderTop: `1px solid ${colors.surface}`,
                }}
              >
                当番人数
              </td>
              {days.map((d) => {
                const date = dateKey(year, month, d);
                const counts = Object.entries(dutyCountsByDate[date] ?? {});
                return (
                  <td
                    key={d}
                    style={{
                      border: `1px solid ${colors.surface}`,
                      padding: 4,
                      verticalAlign: "top",
                      minWidth: 60,
                    }}
                  >
                    {counts.map(([id, count]) => (
                      <div key={id} style={{ fontSize: 9, color: colors.brandDark }}>
                        {dutyName(id)}:{count}
                      </div>
                    ))}
                  </td>
                );
              })}
              <td colSpan={summaryColumnCount} style={{ borderTop: `1px solid ${colors.surface}` }} />
            </tr>
            {members.map((m) => (
              <tr key={m.userId}>
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    background: colors.background,
                    padding: 6,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    borderTop: `1px solid ${colors.surface}`,
                  }}
                >
                  {m.displayName}
                </td>
                {days.map((d) => {
                  const date = dateKey(year, month, d);
                  const status = statusFor(m.userId, date);
                  const isEditingCell = editing?.userId === m.userId && editing.date === date;
                  return (
                    <td
                      key={d}
                      onClick={() => canEdit && setEditing(isEditingCell ? null : { userId: m.userId, date })}
                      style={{
                        border: `1px solid ${colors.surface}`,
                        padding: 4,
                        verticalAlign: "top",
                        cursor: canEdit ? "pointer" : "default",
                        background: isEditingCell ? colors.surface : undefined,
                        minWidth: 60,
                      }}
                    >
                      {status?.leaveType && (
                        <div style={{ color: colors.danger, fontWeight: 700 }}>{leaveLabel[status.leaveType]}</div>
                      )}
                      {status?.amShiftTypeId && (
                        <div>
                          {status.amShiftTypeId === status.pmShiftTypeId ? "" : "AM:"}
                          {shiftName(status.amShiftTypeId)}
                        </div>
                      )}
                      {status?.pmShiftTypeId && status.pmShiftTypeId !== status.amShiftTypeId && (
                        <div>PM:{shiftName(status.pmShiftTypeId)}</div>
                      )}
                      {status?.dutyTypeIds?.map((id) => (
                        <div key={id} style={{ color: colors.brandDark }}>
                          {dutyName(id)}
                        </div>
                      ))}
                    </td>
                  );
                })}
                {activeDutyTypes.map((d) => (
                  <td
                    key={d.dutyTypeId}
                    style={{
                      border: `1px solid ${colors.surface}`,
                      borderLeft: `2px solid ${colors.surface}`,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {dutyCountsByMember[m.userId]?.[d.dutyTypeId] || ""}
                  </td>
                ))}
                {activeShiftTypes.map((s) => (
                  <td
                    key={s.shiftTypeId}
                    style={{
                      border: `1px solid ${colors.surface}`,
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {shiftCountsByMember[m.userId]?.[s.shiftTypeId] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPanel
          member={members.find((m) => m.userId === editing.userId)}
          date={editing.date}
          status={statusFor(editing.userId, editing.date)}
          dutyTypes={dutyTypes}
          shiftTypes={shiftTypes}
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
    </div>
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
    <div style={{ marginTop: 16, border: `1px solid ${colors.surface}`, borderRadius: 14, padding: 16, maxWidth: 420 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>
          {date} のメモ
        </h3>
        <button onClick={onClose}>閉じる</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        style={{ width: "100%", marginTop: 12, boxSizing: "border-box" }}
        placeholder="この日全体に関する備考（例：避難訓練あり）"
      />
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={() => onSave(value)}>
          保存
        </button>
        <button type="button" onClick={onClear}>
          このメモを削除
        </button>
      </div>
    </div>
  );
}

function EditPanel({
  member,
  date,
  status,
  dutyTypes,
  shiftTypes,
  onSave,
  onClear,
  onClose,
}: {
  member: { displayName: string } | undefined;
  date: string;
  status: MemberDailyStatus | undefined;
  dutyTypes: DutyType[];
  shiftTypes: ShiftType[];
  onSave: (patch: Partial<MemberDailyStatus>) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [leaveType, setLeaveType] = useState<LeaveType | "">(status?.leaveType ?? "");
  const [leaveReason, setLeaveReason] = useState<LeaveReason>(status?.leaveReason ?? "ASSIGNED");
  const [amShiftTypeId, setAmShiftTypeId] = useState(status?.amShiftTypeId ?? "");
  const [pmShiftTypeId, setPmShiftTypeId] = useState(status?.pmShiftTypeId ?? "");
  const [dutyTypeIds, setDutyTypeIds] = useState<string[]>(status?.dutyTypeIds ?? []);

  const toggleDuty = (id: string) => {
    setDutyTypeIds((prev) => (prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onSave({
      leaveType: leaveType || undefined,
      leaveReason: leaveType ? leaveReason : undefined,
      amShiftTypeId: amShiftTypeId || undefined,
      pmShiftTypeId: pmShiftTypeId || undefined,
      dutyTypeIds: dutyTypeIds.length > 0 ? dutyTypeIds : undefined,
    });
  };

  return (
    <div style={{ marginTop: 16, border: `1px solid ${colors.surface}`, borderRadius: 14, padding: 16, maxWidth: 420 }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>
          {member?.displayName} ・ {date}
        </h3>
        <button onClick={onClose}>閉じる</button>
      </div>
      <label style={{ display: "block", marginTop: 12 }}>
        休日
        <select value={leaveType} onChange={(e) => setLeaveType(e.target.value as LeaveType | "")}>
          <option value="">なし</option>
          <option value="FULL">終日休み</option>
          <option value="AM">午前休</option>
          <option value="PM">午後休</option>
        </select>
      </label>
      {leaveType && (
        <label style={{ display: "block", marginTop: 8 }}>
          区分
          <select value={leaveReason} onChange={(e) => setLeaveReason(e.target.value as LeaveReason)}>
            <option value="REQUESTED">{leaveReasonLabel.REQUESTED}</option>
            <option value="ASSIGNED">{leaveReasonLabel.ASSIGNED}</option>
          </select>
        </label>
      )}
      <label style={{ display: "block", marginTop: 8 }}>
        午前のシフト
        <select value={amShiftTypeId} onChange={(e) => setAmShiftTypeId(e.target.value)}>
          <option value="">なし</option>
          {shiftTypes
            .filter((s) => s.isActive || s.shiftTypeId === amShiftTypeId)
            .map((s) => (
              <option key={s.shiftTypeId} value={s.shiftTypeId}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <label style={{ display: "block", marginTop: 8 }}>
        午後のシフト
        <select value={pmShiftTypeId} onChange={(e) => setPmShiftTypeId(e.target.value)}>
          <option value="">なし</option>
          {shiftTypes
            .filter((s) => s.isActive || s.shiftTypeId === pmShiftTypeId)
            .map((s) => (
              <option key={s.shiftTypeId} value={s.shiftTypeId}>
                {s.name}
              </option>
            ))}
        </select>
      </label>
      <button type="button" onClick={() => setPmShiftTypeId(amShiftTypeId)} style={{ marginTop: 4, fontSize: 12 }}>
        午前と同じにする
      </button>
      <div style={{ marginTop: 12 }}>
        <div style={{ marginBottom: 4 }}>当番（複数可）</div>
        {dutyTypes
          .filter((d) => d.isActive || dutyTypeIds.includes(d.dutyTypeId))
          .map((d) => (
            <label key={d.dutyTypeId} style={{ display: "block", fontSize: 13 }}>
              <input
                type="checkbox"
                checked={dutyTypeIds.includes(d.dutyTypeId)}
                onChange={() => toggleDuty(d.dutyTypeId)}
              />
              {d.name}
            </label>
          ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button type="button" onClick={handleSave}>
          保存
        </button>
        <button type="button" onClick={onClear}>
          この日の記録を削除
        </button>
      </div>
    </div>
  );
}
