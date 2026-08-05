import { Fragment, useState } from "react";
import {
  Users,
  ShieldCheck,
  Tags,
  ClipboardList,
  Link2,
  CalendarCog,
} from "lucide-react";
import type { RolePermissions } from "@on-connect/shared";
import {
  mockMembers,
  mockRoles,
  mockMemberCategories,
  mockBulletinCategories,
  mockCalendarCategories,
  mockOrgLinks,
} from "@on-connect/shared";
import { colors } from "../theme/colors";

type AdminTab = "users" | "roles" | "memberCategories" | "bulletinCategories" | "links" | "calendarCategories";

/** 権限は今後ここにロールではなくメンバー単位で持たせる（設計変更により`Role`からは`permissions`が無くなった） */
const permissionLabels: Record<keyof RolePermissions, string> = {
  manageUsers: "ユーザー管理",
  manageRoles: "ロール管理",
  manageMemberCategories: "メンバーカテゴリ管理",
  manageOrgLinks: "リンク集管理",
  sendForceNotify: "緊急通知の送信",
  manageBulletinCategories: "掲示板カテゴリー管理",
  manageCalendarCategories: "カレンダーカテゴリー管理",
  manageShifts: "当番・シフト編集",
};

/**
 * 管理者用設定画面（7章 11番）
 * ユーザー管理（メンバー個別の権限ON/OFF編集）／ロール管理（名前ラベルのみ）／メンバーカテゴリ管理
 * ／掲示板カテゴリー管理／リンク集管理／カレンダーカテゴリー管理
 */
export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [members, setMembers] = useState(mockMembers);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  const togglePermission = (userId: string, key: keyof RolePermissions) => {
    // TODO: PUT /users/{userId} で permissions を更新する（現状はローカルstateのみ）
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, permissions: { ...m.permissions, [key]: !m.permissions[key] } } : m,
      ),
    );
  };

  const tabs: { key: AdminTab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "ユーザー管理", icon: Users },
    { key: "roles", label: "ロール・権限管理", icon: ShieldCheck },
    { key: "memberCategories", label: "メンバーカテゴリ管理", icon: Tags },
    { key: "bulletinCategories", label: "掲示板カテゴリー管理", icon: ClipboardList },
    { key: "links", label: "リンク集管理", icon: Link2 },
    { key: "calendarCategories", label: "カレンダーカテゴリー管理", icon: CalendarCog },
  ];

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
          <p style={{ fontSize: 13, color: colors.textMuted, maxWidth: 560 }}>
            権限はロールではなく、メンバー1人1人に個別に設定します（最後の1名の「ユーザー管理」権限は削除・剥奪できません）。
          </p>
          {/* TODO: ロール/メンバーカテゴリの割り当て・権限編集をAPIに接続する（現状はローカルstateのみ） */}
          <div style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, overflow: "hidden", maxWidth: 640 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: colors.textMuted }}>
                <th style={{ padding: 6 }}>氏名</th>
                <th style={{ padding: 6 }}>ロール</th>
                <th style={{ padding: 6 }}>メンバーカテゴリ</th>
                <th style={{ padding: 6 }}>通知</th>
                <th style={{ padding: 6 }}>権限</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <Fragment key={m.userId}>
                  <tr style={{ borderTop: `1px solid ${colors.surface}` }}>
                    <td style={{ padding: 6 }}>{m.displayName}</td>
                    <td style={{ padding: 6 }}>{mockRoles.find((r) => r.roleId === m.roleId)?.name}</td>
                    <td style={{ padding: 6 }}>{mockMemberCategories.find((c) => c.categoryId === m.memberCategoryId)?.name}</td>
                    <td style={{ padding: 6 }}>{m.notificationStatus === "ON" ? "オン" : "オフ"}</td>
                    <td style={{ padding: 6 }}>
                      <button onClick={() => setExpandedUserId(expandedUserId === m.userId ? null : m.userId)}>
                        {expandedUserId === m.userId ? "閉じる" : "編集"}
                      </button>
                    </td>
                  </tr>
                  {expandedUserId === m.userId && (
                    <tr style={{ borderTop: `1px solid ${colors.surface}` }}>
                      <td colSpan={5} style={{ padding: "8px 6px", background: colors.surface }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
                          {(Object.keys(permissionLabels) as (keyof RolePermissions)[]).map((key) => (
                            <label key={key} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                              <input
                                type="checkbox"
                                checked={m.permissions[key]}
                                onChange={() => togglePermission(m.userId, key)}
                              />
                              {permissionLabels[key]}
                            </label>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          </div>
        </section>
      )}
      {tab === "roles" && (
        <section>
          <h3>ロール管理</h3>
          <p style={{ fontSize: 13, color: colors.textMuted }}>
            ロールは表示用の名前ラベルです（権限は「ユーザー管理」タブでメンバーごとに個別設定します）。
          </p>
          {/* TODO: 追加・編集・削除をAPIに接続する（現状はダミーデータ表示） */}
          <ul>
            {mockRoles.map((r) => (
              <li key={r.roleId}>{r.name}</li>
            ))}
          </ul>
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
          {/* TODO: 追加・編集・削除をAPIに接続する（現状はダミーデータ表示） */}
          <ul>
            {mockBulletinCategories.map((c) => (
              <li key={c.categoryId}>{c.name}</li>
            ))}
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
      {tab === "calendarCategories" && (
        <section>
          <h3>カレンダーカテゴリー管理</h3>
          {/* TODO: 追加・編集・削除をAPIに接続する（現状はダミーデータ表示） */}
          <ul>
            {mockCalendarCategories.map((c) => (
              <li key={c.categoryId}>{c.name}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
