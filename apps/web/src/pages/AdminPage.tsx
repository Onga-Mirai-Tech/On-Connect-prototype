import { useState } from "react";
import {
  Users,
  ShieldCheck,
  Tags,
  ClipboardList,
  Link2,
  CalendarCog,
} from "lucide-react";
import { mockMembers, mockRoles, mockMemberCategories, mockOrgLinks } from "@on-connect/shared";
import { colors } from "../theme/colors";

type AdminTab = "users" | "roles" | "memberCategories" | "bulletinCategories" | "links" | "calendar";

/**
 * 管理者用設定画面（7章 11番）
 * ユーザー管理／ロール・権限管理（ON/OFF編集）／メンバーカテゴリ管理／掲示板カテゴリー管理／リンク集管理
 * ／カレンダー連携設定（表示するGoogleカレンダーの指定。編集自体はGoogleカレンダー側で行う）
 */
export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [calendarId, setCalendarId] = useState("");

  const tabs: { key: AdminTab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "ユーザー管理", icon: Users },
    { key: "roles", label: "ロール・権限管理", icon: ShieldCheck },
    { key: "memberCategories", label: "メンバーカテゴリ管理", icon: Tags },
    { key: "bulletinCategories", label: "掲示板カテゴリー管理", icon: ClipboardList },
    { key: "links", label: "リンク集管理", icon: Link2 },
    { key: "calendar", label: "カレンダー連携設定", icon: CalendarCog },
  ];

  const handleSaveCalendar = () => {
    // TODO: PUT /calendar/config を呼び出し、OrgSettingsテーブルへ保存する
  };

  return (
    <div>
      <h2>管理者設定</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            disabled={tab === t.key}
            onClick={() => setTab(t.key)}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && (
        <section>
          <h3>ユーザー管理</h3>
          {/* TODO: ロール/メンバーカテゴリの割り当て編集をAPIに接続する（現状はダミーデータ表示） */}
          <div style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, overflow: "hidden", maxWidth: 640 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: colors.textMuted }}>
                <th style={{ padding: 6 }}>氏名</th>
                <th style={{ padding: 6 }}>ロール</th>
                <th style={{ padding: 6 }}>メンバーカテゴリ</th>
                <th style={{ padding: 6 }}>通知</th>
              </tr>
            </thead>
            <tbody>
              {mockMembers.map((m) => (
                <tr key={m.userId} style={{ borderTop: `1px solid ${colors.surface}` }}>
                  <td style={{ padding: 6 }}>{m.displayName}</td>
                  <td style={{ padding: 6 }}>{mockRoles.find((r) => r.roleId === m.roleId)?.name}</td>
                  <td style={{ padding: 6 }}>{mockMemberCategories.find((c) => c.categoryId === m.memberCategoryId)?.name}</td>
                  <td style={{ padding: 6 }}>{m.notificationStatus === "ON" ? "オン" : "オフ"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
      {tab === "roles" && (
        <section>
          <h3>ロール・権限管理</h3>
          <p>権限項目をロールごとにON/OFF編集できます（最後の1名の管理者権限は削除不可）。</p>
          {/* TODO: Rolesテーブルのpermissionsマップ編集UIをAPIに接続する（現状はダミーデータ表示） */}
          {mockRoles.map((role) => (
            <div key={role.roleId} style={{ marginBottom: 12 }}>
              <strong>{role.name}</strong>
              <ul style={{ margin: "4px 0", paddingLeft: 20, fontSize: 13, color: colors.textMuted }}>
                {Object.entries(role.permissions).map(([key, value]) => (
                  <li key={key}>
                    {key}：{value ? "許可" : "不可"}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      {tab === "memberCategories" && (
        <section>
          <h3>メンバーカテゴリ管理</h3>
          {/* TODO: 追加・編集・削除をAPIに接続する（現状はダミーデータ表示） */}
          <ul>
            {mockMemberCategories.map((c) => (
              <li key={c.categoryId}>{c.name}</li>
            ))}
          </ul>
        </section>
      )}
      {tab === "bulletinCategories" && (
        <section>
          <h3>掲示板カテゴリー管理</h3>
          {/* TODO: 掲示板カテゴリーの追加・編集・削除 */}
          <ul>
            <li>お知らせ</li>
            <li>行事</li>
            <li>緊急連絡</li>
          </ul>
        </section>
      )}
      {tab === "links" && (
        <section>
          <h3>リンク集管理</h3>
          {/* TODO: OrgLinksのCRUDをAPIに接続する（現状はダミーデータ表示） */}
          <ul>
            {mockOrgLinks.map((l) => (
              <li key={l.linkId}>
                {l.title}（{l.category}）
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === "calendar" && (
        <section>
          <h3>カレンダー連携設定</h3>
          <p style={{ fontSize: 13, color: colors.textMuted, maxWidth: 560 }}>
            共有カレンダーの作成・編集はこれまで通りGoogleカレンダー側で行います。ここではアプリ内に
            閲覧専用で表示するカレンダーを指定するだけです。メンバー個々のGoogleアカウント連携は不要です。
            あらかじめGoogle Cloudでサービスアカウントを作成し、表示したいGoogleカレンダー（園の共有カレンダー）の
            共有設定でそのサービスアカウントのメールアドレスに「閲覧権限」を付与してください。
            そのうえで、下記にカレンダーID（共有カレンダーの場合は
            xxxx@group.calendar.google.com 形式、個人カレンダーの場合はそのアカウントのメールアドレス）を入力します。
          </p>
          <label style={{ display: "block", marginTop: 12 }}>
            カレンダーID
            <input
              type="text"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="xxxx@group.calendar.google.com"
              style={{ display: "block", width: 360, marginTop: 4, padding: 8 }}
            />
          </label>
          <button onClick={handleSaveCalendar} style={{ marginTop: 12 }}>
            保存
          </button>
        </section>
      )}
    </div>
  );
}
