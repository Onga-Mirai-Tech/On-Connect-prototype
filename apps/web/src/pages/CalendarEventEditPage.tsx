import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockCalendarEvents, mockCalendarCategories, mockMemberCategories } from "@on-connect/shared";

/**
 * カレンダー予定の作成・編集画面。全メンバーが作成・編集できる（バックエンド側に権限チェックは無い）。
 * TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ、保存は一覧に戻るだけ）
 */
export function CalendarEventEditPage() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const existingEvent = eventId ? mockCalendarEvents.find((e) => e.eventId === eventId) : undefined;

  const [title, setTitle] = useState(existingEvent?.title ?? "");
  const [description, setDescription] = useState(existingEvent?.description ?? "");
  const [startAt, setStartAt] = useState(existingEvent?.startAt.slice(0, 16) ?? "");
  const [endAt, setEndAt] = useState(existingEvent?.endAt.slice(0, 16) ?? "");

  const handleSave = () => {
    // TODO: POST/PUT /calendar-events を呼び出して保存する
    console.log("save calendar event", { title, description, startAt, endAt });
    navigate(eventId ? `/calendar/${eventId}` : "/calendar");
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
        <select defaultValue={existingEvent?.categoryId ?? mockCalendarCategories[0]?.categoryId}>
          {mockCalendarCategories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div>
        <h3>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</h3>
        {mockMemberCategories.map((c) => (
          <label key={c.categoryId} style={{ display: "block" }}>
            <input type="checkbox" defaultChecked={existingEvent?.visibleCategoryIds.includes(c.categoryId)} />
            {c.name}
          </label>
        ))}
      </div>
      <button type="button" onClick={handleSave} style={{ marginTop: 12 }}>
        保存
      </button>
    </div>
  );
}
