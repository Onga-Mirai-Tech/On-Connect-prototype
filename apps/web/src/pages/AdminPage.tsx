import { Fragment, useState } from "react";
import {
  Users,
  ShieldCheck,
  Tags,
  ClipboardList,
  Link2,
  CalendarCog,
  UserPlus,
  KeyRound,
  Pencil,
  Trash2,
} from "lucide-react";
import type { RolePermissions } from "@on-connect/shared";
import { mockBulletinCategories, mockCalendarCategories, mockOrgLinks } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { orgApi, type AdminUser } from "../api/orgApi";
import { useOrgData } from "../context/OrgDataContext";

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

const loginStatusLabel: Record<string, string> = {
  FORCE_CHANGE_PASSWORD: "初回ログイン未了",
  CONFIRMED: "ログイン済み",
  UNPROVISIONED: "未発行",
};

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
 * ／ロール管理／メンバーカテゴリ管理／掲示板カテゴリー管理／リンク集管理／カレンダーカテゴリー管理
 * Phase 8b：ユーザー・ロール・メンバーカテゴリは本物のREST APIに接続済み（未接続時はダミーデータにフォールバック）。
 */
export function AdminPage() {
  const [tab, setTab] = useState<AdminTab>("users");
  const { members, roles, memberCategories, refetchMembers, refetchRoles, refetchMemberCategories } = useOrgData();
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [permissionPendingUserId, setPermissionPendingUserId] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState("");

  const togglePermission = async (userId: string, key: keyof RolePermissions) => {
    const member = members.find((m) => m.userId === userId);
    if (!member) return;
    setPermissionError("");
    setPermissionPendingUserId(userId);
    try {
      await orgApi.updateUser(userId, { permissions: { ...member.permissions, [key]: !member.permissions[key] } });
      await refetchMembers();
    } catch (err) {
      setPermissionError(err instanceof Error ? err.message : "権限の更新に失敗しました");
    } finally {
      setPermissionPendingUserId(null);
    }
  };

  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({
    displayName: "",
    furigana: "",
    loginId: "",
    roleId: roles[0]?.roleId ?? "",
    memberCategoryId: memberCategories[0]?.categoryId ?? "",
  });
  const [addSubmitting, setAddSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [addResult, setAddResult] = useState<{ loginId: string; temporaryPassword: string } | null>(null);

  const openAddForm = () => {
    setNewStaff({
      displayName: "",
      furigana: "",
      loginId: suggestNextLoginId(members),
      roleId: roles[0]?.roleId ?? "",
      memberCategoryId: memberCategories[0]?.categoryId ?? "",
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
      const body = await orgApi.createUser({
        loginId: newStaff.loginId,
        displayName: newStaff.displayName,
        furigana: newStaff.furigana,
        roleId: newStaff.roleId,
        memberCategoryId: newStaff.memberCategoryId,
      });
      await refetchMembers();
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
      const body = await orgApi.resetPassword(member.userId);
      setResetResult({ loginId: member.loginId, temporaryPassword: body.temporaryPassword });
    } catch (err) {
      setResetError(err instanceof Error ? err.message : "パスワードの再発行に失敗しました");
    }
  };

  // ロール管理
  const [newRoleName, setNewRoleName] = useState("");
  const [roleSubmitting, setRoleSubmitting] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const [editingRoleName, setEditingRoleName] = useState("");

  const handleAddRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName.trim()) return;
    setRoleError("");
    setRoleSubmitting(true);
    try {
      await orgApi.createRole(newRoleName.trim());
      await refetchRoles();
      setNewRoleName("");
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "ロールの追加に失敗しました");
    } finally {
      setRoleSubmitting(false);
    }
  };

  const handleSaveRoleName = async (roleId: string) => {
    if (!editingRoleName.trim()) return;
    setRoleError("");
    try {
      await orgApi.updateRole(roleId, editingRoleName.trim());
      await refetchRoles();
      setEditingRoleId(null);
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "ロールの更新に失敗しました");
    }
  };

  const handleDeleteRole = async (roleId: string) => {
    setRoleError("");
    try {
      await orgApi.deleteRole(roleId);
      await refetchRoles();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : "ロールの削除に失敗しました");
    }
  };

  // メンバーカテゴリ管理
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySubmitting, setCategorySubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setCategoryError("");
    setCategorySubmitting(true);
    try {
      await orgApi.createMemberCategory(newCategoryName.trim());
      await refetchMemberCategories();
      setNewCategoryName("");
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "メンバーカテゴリの追加に失敗しました");
    } finally {
      setCategorySubmitting(false);
    }
  };

  const handleSaveCategoryName = async (categoryId: string) => {
    if (!editingCategoryName.trim()) return;
    setCategoryError("");
    try {
      await orgApi.updateMemberCategory(categoryId, editingCategoryName.trim());
      await refetchMemberCategories();
      setEditingCategoryId(null);
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "メンバーカテゴリの更新に失敗しました");
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    setCategoryError("");
    try {
      await orgApi.deleteMemberCategory(categoryId);
      await refetchMemberCategories();
    } catch (err) {
      setCategoryError(err instanceof Error ? err.message : "メンバーカテゴリの削除に失敗しました");
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
                  {roles.map((r) => (
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
                  {memberCategories.map((c) => (
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

          {permissionError && <p style={{ color: colors.danger, fontSize: 13 }}>{permissionError}</p>}
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
                    <td style={{ padding: 6 }}>{roles.find((r) => r.roleId === m.roleId)?.name}</td>
                    <td style={{ padding: 6 }}>{memberCategories.find((c) => c.categoryId === m.memberCategoryId)?.name}</td>
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
                                disabled={permissionPendingUserId === m.userId}
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
          <form onSubmit={handleAddRole} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="ロール名（例：保育士）"
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={roleSubmitting}>
              追加
            </button>
          </form>
          {roleError && <p style={{ color: colors.danger, fontSize: 13 }}>{roleError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 360 }}>
            {roles.map((r) => (
              <li
                key={r.roleId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingRoleId === r.roleId ? (
                  <>
                    <input
                      type="text"
                      value={editingRoleName}
                      onChange={(e) => setEditingRoleName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveRoleName(r.roleId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingRoleId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{r.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoleId(r.roleId);
                        setEditingRoleName(r.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRole(r.roleId)}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Trash2 size={14} /> 削除
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === "memberCategories" && (
        <section>
          <h3>メンバーカテゴリ管理</h3>
          <form onSubmit={handleAddCategory} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="カテゴリ名（例：保育士）"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={categorySubmitting}>
              追加
            </button>
          </form>
          {categoryError && <p style={{ color: colors.danger, fontSize: 13 }}>{categoryError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 360 }}>
            {memberCategories.map((c) => (
              <li
                key={c.categoryId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingCategoryId === c.categoryId ? (
                  <>
                    <input
                      type="text"
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveCategoryName(c.categoryId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingCategoryId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCategoryId(c.categoryId);
                        setEditingCategoryName(c.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(c.categoryId)}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Trash2 size={14} /> 削除
                    </button>
                  </>
                )}
              </li>
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
