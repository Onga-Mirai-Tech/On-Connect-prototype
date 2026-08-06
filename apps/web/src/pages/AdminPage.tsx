import { Fragment, useState, useEffect } from "react";
import {
  Users,
  ShieldCheck,
  Tags,
  ClipboardList,
  Link2,
  CalendarCog,
  UserPlus,
  KeyRound,
} from "lucide-react";
import { fetchAuthSession } from "aws-amplify/auth";
import type { RolePermissions, User } from "@on-connect/shared";
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

type AdminUser = User & { loginStatus?: string };

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

const loginStatusLabel: Record<string, string> = {
  FORCE_CHANGE_PASSWORD: "初回ログイン未了",
  CONFIRMED: "ログイン済み",
  UNPROVISIONED: "未発行",
};

const API_URL = import.meta.env.VITE_API_URL;

/** Cognitoのトークンを付けてREST APIを呼ぶ（Phase 8a：スタッフ追加・ログイン状況・パスワード再発行のみ本物のAPIに接続する） */
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() ?? "";
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: token, "Content-Type": "application/json" },
  });
}

/** 次のログインID候補（staffNN方式）を提案する。既存の番号の最大値+1、編集可能。 */
function suggestNextLoginId(members: AdminUser[]): string {
  const numbers = members
    .map((m) => /^staff(\d+)$/.exec(m.loginId)?.[1])
    .filter((n): n is string => !!n)
    .map(Number);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `staff${String(next).padStart(2, "0")}`;
}

/**
 * 管理者用設定画面（7章 11番）
 * ユーザー管理（メンバー個別の権限ON/OFF編集・スタッフ追加・ログイン状況確認・パスワード再発行）
 * ／ロール管理（名前ラベルのみ）／メンバーカテゴリ管理／掲示板カテゴリー管理／リンク集管理
 * ／カレンダーカテゴリー管理
 */
export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");
  const [members, setMembers] = useState<AdminUser[]>(mockMembers);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

  // ユーザー一覧はAPI接続を試み、未デプロイ等で失敗した場合はダミーデータで表示する（Phase 8a）
  useEffect(() => {
    (async () => {
      try {
        if (!API_URL) throw new Error("API未接続");
        const res = await authFetch("/users");
        if (!res.ok) throw new Error("メンバー一覧の取得に失敗しました");
        setMembers((await res.json()) as AdminUser[]);
      } catch {
        setMembers(mockMembers);
      }
    })();
  }, []);

  const togglePermission = (userId: string, key: keyof RolePermissions) => {
    // TODO: PUT /users/{userId} で permissions を更新する（現状はローカルstateのみ）
    setMembers((prev) =>
      prev.map((m) =>
        m.userId === userId ? { ...m, permissions: { ...m.permissions, [key]: !m.permissions[key] } } : m,
      ),
    );
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({
    displayName: "",
    furigana: "",
    loginId: "",
    roleId: mockRoles[0]?.roleId ?? "",
    memberCategoryId: mockMemberCategories[0]?.categoryId ?? "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [addResult, setAddResult] = useState<{ loginId: string; temporaryPassword: string } | null>(null);

  const openAddForm = () => {
    setNewStaff({
      displayName: "",
      furigana: "",
      loginId: suggestNextLoginId(members),
      roleId: mockRoles[0]?.roleId ?? "",
      memberCategoryId: mockMemberCategories[0]?.categoryId ?? "",
    });
    setAddResult(null);
    setAddError("");
    setShowAddForm(true);
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    setAddSubmitting(true);
    try {
      const res = await authFetch("/users", {
        method: "POST",
        body: JSON.stringify({
          loginId: newStaff.loginId,
          displayName: newStaff.displayName,
          furigana: newStaff.furigana,
          roleId: newStaff.roleId,
          memberCategoryId: newStaff.memberCategoryId,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { message?: string });
        throw new Error(body.message ?? "スタッフの追加に失敗しました");
      }
      const body = (await res.json()) as { user: AdminUser; temporaryPassword: string };
      setMembers((prev) => [...prev, body.user]);
      setAddResult({ loginId: body.user.loginId, temporaryPassword: body.temporaryPassword });
      setShowAddForm(false);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "スタッフの追加に失敗しました");
    } finally {
      setAddSubmitting(false);
    }
  };

  const [resetResult, setResetResult] = useState<{ loginId: string; temporaryPassword: string } | null>(null);
  const [resetError, setResetError] = useState("");

  const handleResetPassword = async (member: AdminUser) => {
    setResetError("");
    setResetResult(null);
    try {
      const res = await authFetch(`/users/${member.userId}/reset-password`, { method: "POST" });
      if (!res.ok) throw new Error("パスワードの再発行に失敗しました");
      const body = (await res.json()) as { temporaryPassword: string };
      setResetResult({ loginId: member.loginId, temporaryPassword: body.temporaryPassword });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "パスワードの再発行に失敗しました");
    }
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>ユーザー管理</h3>
            <button type="button" onClick={openAddForm} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <UserPlus size={14} /> スタッフを追加
            </button>
          </div>
          <p style={{ fontSize: 13, color: colors.textMuted, maxWidth: 560 }}>
            権限はロールではなく、メンバー1人1人に個別に設定します（最後の1名の「ユーザー管理」権限は削除・剥奪できません）。
          </p>

          {showAddForm && (
            <form
              onSubmit={handleAddStaff}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxWidth: 360,
                border: `1px solid ${colors.surface}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
              }}
            >
              <input
                type="text"
                placeholder="表示名（例：山田 太郎）"
                value={newStaff.displayName}
                onChange={(e) => setNewStaff((s) => ({ ...s, displayName: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="ふりがな（例：やまだ たろう）"
                value={newStaff.furigana}
                onChange={(e) => setNewStaff((s) => ({ ...s, furigana: e.target.value }))}
                required
              />
              <label style={{ fontSize: 12, color: colors.textMuted }}>
                ログインID（紙で本人に渡すID。編集可能）
                <input
                  type="text"
                  value={newStaff.loginId}
                  onChange={(e) => setNewStaff((s) => ({ ...s, loginId: e.target.value }))}
                  required
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                />
              </label>
              <label style={{ fontSize: 12, color: colors.textMuted }}>
                ロール
                <select
                  value={newStaff.roleId}
                  onChange={(e) => setNewStaff((s) => ({ ...s, roleId: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                >
                  {mockRoles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: colors.textMuted }}>
                メンバーカテゴリ
                <select
                  value={newStaff.memberCategoryId}
                  onChange={(e) => setNewStaff((s) => ({ ...s, memberCategoryId: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                >
                  {mockMemberCategories.map((c) => (
                    <option key={c.categoryId} value={c.categoryId}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              {addError && <p style={{ color: colors.danger, fontSize: 13, margin: 0 }}>{addError}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={addSubmitting}>
                  作成する
                </button>
                <button type="button" onClick={() => setShowAddForm(false)}>
                  キャンセル
                </button>
              </div>
            </form>
          )}

          {addResult && (
            <div
              style={{
                maxWidth: 360,
                border: `1px solid ${colors.danger}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                background: "#FDECEC",
              }}
            >
              <p style={{ fontWeight: 700, margin: "0 0 8px" }}>アカウントを作成しました</p>
              <p style={{ margin: "0 0 4px" }}>
                ログインID：<strong>{addResult.loginId}</strong>
              </p>
              <p style={{ margin: "0 0 8px" }}>
                仮パスワード：<strong>{addResult.temporaryPassword}</strong>
              </p>
              <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>
                この画面を閉じると再表示できません。紙などの物理媒体で本人に手渡してください
                （再表示が必要な場合は下の「パスワード再発行」を使用してください）。
              </p>
              <button type="button" onClick={() => setAddResult(null)} style={{ marginTop: 8 }}>
                閉じる
              </button>
            </div>
          )}

          {resetError && <p style={{ color: colors.danger, fontSize: 13 }}>{resetError}</p>}
          {resetResult && (
            <div
              style={{
                maxWidth: 360,
                border: `1px solid ${colors.danger}`,
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                background: "#FDECEC",
              }}
            >
              <p style={{ fontWeight: 700, margin: "0 0 8px" }}>パスワードを再発行しました</p>
              <p style={{ margin: "0 0 4px" }}>
                ログインID：<strong>{resetResult.loginId}</strong>
              </p>
              <p style={{ margin: "0 0 8px" }}>
                新しい仮パスワード：<strong>{resetResult.temporaryPassword}</strong>
              </p>
              <p style={{ fontSize: 12, color: colors.danger, margin: 0 }}>
                この画面を閉じると再表示できません。紙などの物理媒体で本人に手渡してください。
              </p>
              <button type="button" onClick={() => setResetResult(null)} style={{ marginTop: 8 }}>
                閉じる
              </button>
            </div>
          )}

          {/* TODO: ロール/メンバーカテゴリの割り当て・権限編集をAPIに接続する（現状はローカルstateのみ） */}
          <div style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, overflow: "hidden", maxWidth: 720 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: colors.textMuted }}>
                <th style={{ padding: 6 }}>氏名</th>
                <th style={{ padding: 6 }}>ロール</th>
                <th style={{ padding: 6 }}>メンバーカテゴリ</th>
                <th style={{ padding: 6 }}>通知</th>
                <th style={{ padding: 6 }}>ログイン状況</th>
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
                      {m.loginStatus ? (loginStatusLabel[m.loginStatus] ?? m.loginStatus) : "—"}
                    </td>
                    <td style={{ padding: 6 }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setExpandedUserId(expandedUserId === m.userId ? null : m.userId)}>
                          {expandedUserId === m.userId ? "閉じる" : "編集"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleResetPassword(m)}
                          style={{ display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <KeyRound size={14} /> パスワード再発行
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedUserId === m.userId && (
                    <tr style={{ borderTop: `1px solid ${colors.surface}` }}>
                      <td colSpan={6} style={{ padding: "8px 6px", background: colors.surface }}>
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
