import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  mockMembers,
  mockMemberDailyStatuses,
  mockDutyTypes,
  mockShiftTypes,
  mockCurrentUserId,
  type MemberDailyStatus,
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

/**
 * シフト管理画面：休日・当番・シフトを月間グリッド（メンバー×日付）で表示する。
 * 編集はmanageShifts権限を持つ人のみ（本人の分も含め自己申告はできない）。閲覧は全員に開放。
 * TODO: GET /member-daily-status?date=... / PUT /member-daily-status/{date}/{userId} をAPIに接続する
 * （現状はダミーデータのローカルstateのみ）
 */
export function ShiftManagementPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [statuses, setStatuses] = useState(mockMemberDailyStatuses);
  const [editing, setEditing] = useState<{ userId: string; date: string } | null>(null);

  const currentUser = mockMembers.find((m) => m.userId === mockCurrentUserId);
  const canEdit = currentUser?.permissions.manageShifts ?? false;

  const dayCount = daysInMonth(year, month);
  const days = Array.from({ length: dayCount }, (_, i) => i + 1);

  const statusFor = (userId: string, date: string) => statuses.find((s) => s.userId === userId && s.date === date);
  const shiftName = (id: string | undefined) => mockShiftTypes.find((s) => s.shiftTypeId === id)?.name;
  const dutyName = (id: string) => mockDutyTypes.find((d) => d.dutyTypeId === id)?.name ?? id;

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
  };

  const handleClear = (userId: string, date: string) => {
    // TODO: DELETE /member-daily-status/{date}/{userId} を呼び出す
    setStatuses((prev) => prev.filter((s) => !(s.userId === userId && s.date === date)));
    setEditing(null);
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
          ? "セルをタップすると休日・当番・シフトを編集できます。"
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
              {days.map((d) => (
                <th key={d} style={{ minWidth: 60, padding: 4, color: colors.textMuted }}>
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mockMembers.map((m) => (
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <EditPanel
          member={mockMembers.find((m) => m.userId === editing.userId)}
          date={editing.date}
          status={statusFor(editing.userId, editing.date)}
          onSave={(patch) => handleSave(editing.userId, editing.date, patch)}
          onClear={() => handleClear(editing.userId, editing.date)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditPanel({
  member,
  date,
  status,
  onSave,
  onClear,
  onClose,
}: {
  member: { displayName: string } | undefined;
  date: string;
  status: MemberDailyStatus | undefined;
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
          {mockShiftTypes
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
          {mockShiftTypes
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
        {mockDutyTypes
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
