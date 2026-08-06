import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockCalendarEvents } from "@on-connect/shared";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

/**
 * カレンダー予定の作成・編集画面。全メンバーが作成・編集できる（バックエンド側に権限チェックは無い）。
 * Phase 8c：保存処理をAPIに接続
 */
export function CalendarEventEditPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { memberCategories, calendarCategories, isLoading } = useOrgData();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 新規作成時のデフォルトカテゴリー：OrgDataContextの初期値はローディング中のモックフォールバックのため
  // calendarCategoriesの中身だけでは実データか判定できない。isLoadingがfalseになる（取得試行完了）まで待つ
  useEffect(() => {
    if (eventId || categoryId || isLoading) return;
    setCategoryId(calendarCategories[0]?.categoryId ?? "");
  }, [eventId, categoryId, isLoading, calendarCategories]);

  useEffect(() => {
    if (!eventId) return;
    (async () => {
      let event;
      try {
        event = await orgApi.getCalendarEvent(eventId);
      } catch {
        event = mockCalendarEvents.find((e) => e.eventId === eventId);
      }
      setTitle(event?.title ?? "");
      setDescription(event?.description ?? "");
      setStartAt(event?.startAt.slice(0, 16) ?? "");
      setEndAt(event?.endAt.slice(0, 16) ?? "");
      setCategoryId(event?.categoryId ?? "");
      setVisibleCategoryIds(event?.visibleCategoryIds ?? []);
    })();
  }, [eventId]);

  const toggleVisibleCategory = (categoryId: string) => {
    setVisibleCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const input = { title, description, startAt, endAt, categoryId: categoryId || undefined, visibleCategoryIds };
      if (eventId) {
        await orgApi.updateCalendarEvent(eventId, input);
        navigate(`/calendar/${eventId}`);
      } else {
        const event = await orgApi.createCalendarEvent(input);
        navigate(`/calendar/${event.eventId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "予定の保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2>{eventId ? "予定を編集" : "予定を追加"}</h2>
      <label style={{ display: "block", marginBottom: 8 }}>
        タイトル
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）定例会議"
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        説明（任意）
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        開始日時
        <input
          type="datetime-local"
          value={startAt}
          onChange={(e) => setStartAt(e.target.value)}
          style={{ display: "block", marginTop: 4 }}
        />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        終了日時
        <input
          type="datetime-local"
          value={endAt}
          onChange={(e) => setEndAt(e.target.value)}
          style={{ display: "block", marginTop: 4 }}
        />
      </label>
      <label>
        表示カテゴリー：
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {calendarCategories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <h3>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</h3>
        {memberCategories.map((c) => (
          <label key={c.categoryId} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={visibleCategoryIds.includes(c.categoryId)}
              onChange={() => toggleVisibleCategory(c.categoryId)}
            />
            {c.name}
          </label>
        ))}
      </div>
      {error && <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>}
      <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        保存
      </button>
    </div>
  );
}
