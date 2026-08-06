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
  ListChecks,
  Clock,
} from "lucide-react";
import type { OrgLink, RolePermissions } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { orgApi, type AdminUser } from "../api/orgApi";
import { useOrgData } from "../context/OrgDataContext";

type AdminTab =
  | "users"
  | "roles"
  | "memberCategories"
  | "bulletinCategories"
  | "links"
  | "calendarCategories"
  | "dutyTypes"
  | "shiftTypes";

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
  const {
    members,
    roles,
    memberCategories,
    orgLinks,
    bulletinCategories,
    calendarCategories,
    dutyTypes,
    shiftTypes,
    refetchMembers,
    refetchRoles,
    refetchMemberCategories,
    refetchOrgLinks,
    refetchBulletinCategories,
    refetchCalendarCategories,
    refetchDutyTypes,
    refetchShiftTypes,
  } = useOrgData();
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

  // リンク集管理
  type LinkFormValue = { title: string; url: string; category: string; sortOrder: string };
  const emptyLinkForm: LinkFormValue = { title: "", url: "", category: "", sortOrder: "0" };
  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [newLink, setNewLink] = useState<LinkFormValue>(emptyLinkForm);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  const [linkError, setLinkError] = useState("");
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLink, setEditingLink] = useState<LinkFormValue>(emptyLinkForm);

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError("");
    setLinkSubmitting(true);
    try {
      await orgApi.createOrgLink({
        title: newLink.title,
        url: newLink.url,
        category: newLink.category || undefined,
        sortOrder: Number(newLink.sortOrder) || 0,
      });
      await refetchOrgLinks();
      setNewLink(emptyLinkForm);
      setShowAddLinkForm(false);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "リンクの追加に失敗しました");
    } finally {
      setLinkSubmitting(false);
    }
  };

  const handleSaveLink = async (linkId: string) => {
    setLinkError("");
    try {
      await orgApi.updateOrgLink(linkId, {
        title: editingLink.title,
        url: editingLink.url,
        category: editingLink.category || undefined,
        sortOrder: Number(editingLink.sortOrder) || 0,
      });
      await refetchOrgLinks();
      setEditingLinkId(null);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "リンクの更新に失敗しました");
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    setLinkError("");
    try {
      await orgApi.deleteOrgLink(linkId);
      await refetchOrgLinks();
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "リンクの削除に失敗しました");
    }
  };

  const startEditLink = (l: OrgLink) => {
    setEditingLinkId(l.linkId);
    setEditingLink({ title: l.title, url: l.url, category: l.category ?? "", sortOrder: String(l.sortOrder) });
  };

  // 掲示板カテゴリ管理
  const [newBulletinCategoryName, setNewBulletinCategoryName] = useState("");
  const [bulletinCategorySubmitting, setBulletinCategorySubmitting] = useState(false);
  const [bulletinCategoryError, setBulletinCategoryError] = useState("");
  const [editingBulletinCategoryId, setEditingBulletinCategoryId] = useState<string | null>(null);
  const [editingBulletinCategoryName, setEditingBulletinCategoryName] = useState("");

  const handleAddBulletinCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulletinCategoryName.trim()) return;
    setBulletinCategoryError("");
    setBulletinCategorySubmitting(true);
    try {
      await orgApi.createBulletinCategory(newBulletinCategoryName.trim());
      await refetchBulletinCategories();
      setNewBulletinCategoryName("");
    } catch (err) {
      setBulletinCategoryError(err instanceof Error ? err.message : "掲示板カテゴリーの追加に失敗しました");
    } finally {
      setBulletinCategorySubmitting(false);
    }
  };

  const handleSaveBulletinCategoryName = async (categoryId: string) => {
    if (!editingBulletinCategoryName.trim()) return;
    setBulletinCategoryError("");
    try {
      await orgApi.updateBulletinCategory(categoryId, editingBulletinCategoryName.trim());
      await refetchBulletinCategories();
      setEditingBulletinCategoryId(null);
    } catch (err) {
      setBulletinCategoryError(err instanceof Error ? err.message : "掲示板カテゴリーの更新に失敗しました");
    }
  };

  const handleDeleteBulletinCategory = async (categoryId: string) => {
    setBulletinCategoryError("");
    try {
      await orgApi.deleteBulletinCategory(categoryId);
      await refetchBulletinCategories();
    } catch (err) {
      setBulletinCategoryError(err instanceof Error ? err.message : "掲示板カテゴリーの削除に失敗しました");
    }
  };

  // カレンダーカテゴリ管理
  const [newCalendarCategoryName, setNewCalendarCategoryName] = useState("");
  const [calendarCategorySubmitting, setCalendarCategorySubmitting] = useState(false);
  const [calendarCategoryError, setCalendarCategoryError] = useState("");
  const [editingCalendarCategoryId, setEditingCalendarCategoryId] = useState<string | null>(null);
  const [editingCalendarCategoryName, setEditingCalendarCategoryName] = useState("");

  const handleAddCalendarCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalendarCategoryName.trim()) return;
    setCalendarCategoryError("");
    setCalendarCategorySubmitting(true);
    try {
      await orgApi.createCalendarCategory(newCalendarCategoryName.trim());
      await refetchCalendarCategories();
      setNewCalendarCategoryName("");
    } catch (err) {
      setCalendarCategoryError(err instanceof Error ? err.message : "カレンダーカテゴリーの追加に失敗しました");
    } finally {
      setCalendarCategorySubmitting(false);
    }
  };

  const handleSaveCalendarCategoryName = async (categoryId: string) => {
    if (!editingCalendarCategoryName.trim()) return;
    setCalendarCategoryError("");
    try {
      await orgApi.updateCalendarCategory(categoryId, editingCalendarCategoryName.trim());
      await refetchCalendarCategories();
      setEditingCalendarCategoryId(null);
    } catch (err) {
      setCalendarCategoryError(err instanceof Error ? err.message : "カレンダーカテゴリーの更新に失敗しました");
    }
  };

  const handleDeleteCalendarCategory = async (categoryId: string) => {
    setCalendarCategoryError("");
    try {
      await orgApi.deleteCalendarCategory(categoryId);
      await refetchCalendarCategories();
    } catch (err) {
      setCalendarCategoryError(err instanceof Error ? err.message : "カレンダーカテゴリーの削除に失敗しました");
    }
  };

  // 当番種別管理
  const [newDutyTypeName, setNewDutyTypeName] = useState("");
  const [dutyTypeSubmitting, setDutyTypeSubmitting] = useState(false);
  const [dutyTypeError, setDutyTypeError] = useState("");
  const [editingDutyTypeId, setEditingDutyTypeId] = useState<string | null>(null);
  const [editingDutyTypeName, setEditingDutyTypeName] = useState("");

  const handleAddDutyType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDutyTypeName.trim()) return;
    setDutyTypeError("");
    setDutyTypeSubmitting(true);
    try {
      await orgApi.createDutyType(newDutyTypeName.trim());
      await refetchDutyTypes();
      setNewDutyTypeName("");
    } catch (err) {
      setDutyTypeError(err instanceof Error ? err.message : "当番種別の追加に失敗しました");
    } finally {
      setDutyTypeSubmitting(false);
    }
  };

  const handleSaveDutyTypeName = async (dutyTypeId: string) => {
    if (!editingDutyTypeName.trim()) return;
    setDutyTypeError("");
    try {
      await orgApi.updateDutyType(dutyTypeId, { name: editingDutyTypeName.trim() });
      await refetchDutyTypes();
      setEditingDutyTypeId(null);
    } catch (err) {
      setDutyTypeError(err instanceof Error ? err.message : "当番種別の更新に失敗しました");
    }
  };

  const handleToggleDutyTypeActive = async (dutyTypeId: string, isActive: boolean) => {
    setDutyTypeError("");
    try {
      await orgApi.updateDutyType(dutyTypeId, { isActive: !isActive });
      await refetchDutyTypes();
    } catch (err) {
      setDutyTypeError(err instanceof Error ? err.message : "当番種別の更新に失敗しました");
    }
  };

  const handleDeleteDutyType = async (dutyTypeId: string) => {
    setDutyTypeError("");
    try {
      await orgApi.deleteDutyType(dutyTypeId);
      await refetchDutyTypes();
    } catch (err) {
      setDutyTypeError(err instanceof Error ? err.message : "当番種別の削除に失敗しました");
    }
  };

  // シフト種別管理
  const [newShiftTypeName, setNewShiftTypeName] = useState("");
  const [shiftTypeSubmitting, setShiftTypeSubmitting] = useState(false);
  const [shiftTypeError, setShiftTypeError] = useState("");
  const [editingShiftTypeId, setEditingShiftTypeId] = useState<string | null>(null);
  const [editingShiftTypeName, setEditingShiftTypeName] = useState("");

  const handleAddShiftType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShiftTypeName.trim()) return;
    setShiftTypeError("");
    setShiftTypeSubmitting(true);
    try {
      await orgApi.createShiftType(newShiftTypeName.trim());
      await refetchShiftTypes();
      setNewShiftTypeName("");
    } catch (err) {
      setShiftTypeError(err instanceof Error ? err.message : "シフト種別の追加に失敗しました");
    } finally {
      setShiftTypeSubmitting(false);
    }
  };

  const handleSaveShiftTypeName = async (shiftTypeId: string) => {
    if (!editingShiftTypeName.trim()) return;
    setShiftTypeError("");
    try {
      await orgApi.updateShiftType(shiftTypeId, { name: editingShiftTypeName.trim() });
      await refetchShiftTypes();
      setEditingShiftTypeId(null);
    } catch (err) {
      setShiftTypeError(err instanceof Error ? err.message : "シフト種別の更新に失敗しました");
    }
  };

  const handleToggleShiftTypeActive = async (shiftTypeId: string, isActive: boolean) => {
    setShiftTypeError("");
    try {
      await orgApi.updateShiftType(shiftTypeId, { isActive: !isActive });
      await refetchShiftTypes();
    } catch (err) {
      setShiftTypeError(err instanceof Error ? err.message : "シフト種別の更新に失敗しました");
    }
  };

  const handleDeleteShiftType = async (shiftTypeId: string) => {
    setShiftTypeError("");
    try {
      await orgApi.deleteShiftType(shiftTypeId);
      await refetchShiftTypes();
    } catch (err) {
      setShiftTypeError(err instanceof Error ? err.message : "シフト種別の削除に失敗しました");
    }
  };

  const tabs: { key: AdminTab; label: string; icon: typeof Users }[] = [
    { key: "users", label: "ユーザー管理", icon: Users },
    { key: "roles", label: "ロール・権限管理", icon: ShieldCheck },
    { key: "memberCategories", label: "メンバーカテゴリ管理", icon: Tags },
    { key: "bulletinCategories", label: "掲示板カテゴリー管理", icon: ClipboardList },
    { key: "links", label: "リンク集管理", icon: Link2 },
    { key: "calendarCategories", label: "カレンダーカテゴリー管理", icon: CalendarCog },
    { key: "dutyTypes", label: "当番種別管理", icon: ListChecks },
    { key: "shiftTypes", label: "シフト種別管理", icon: Clock },
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
          <form onSubmit={handleAddBulletinCategory} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="カテゴリ名（例：緊急連絡）"
              value={newBulletinCategoryName}
              onChange={(e) => setNewBulletinCategoryName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={bulletinCategorySubmitting}>
              追加
            </button>
          </form>
          {bulletinCategoryError && <p style={{ color: colors.danger, fontSize: 13 }}>{bulletinCategoryError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 360 }}>
            {bulletinCategories.map((c) => (
              <li
                key={c.categoryId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingBulletinCategoryId === c.categoryId ? (
                  <>
                    <input
                      type="text"
                      value={editingBulletinCategoryName}
                      onChange={(e) => setEditingBulletinCategoryName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveBulletinCategoryName(c.categoryId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingBulletinCategoryId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBulletinCategoryId(c.categoryId);
                        setEditingBulletinCategoryName(c.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteBulletinCategory(c.categoryId)}
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
      {tab === "links" && (
        <section>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3>リンク集管理</h3>
            <button
              type="button"
              onClick={() => {
                setNewLink(emptyLinkForm);
                setLinkError("");
                setShowAddLinkForm(true);
              }}
            >
              リンクを追加
            </button>
          </div>
          {showAddLinkForm && (
            <form
              onSubmit={handleAddLink}
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
                placeholder="タイトル"
                value={newLink.title}
                onChange={(e) => setNewLink((s) => ({ ...s, title: e.target.value }))}
                required
              />
              <input
                type="url"
                placeholder="URL"
                value={newLink.url}
                onChange={(e) => setNewLink((s) => ({ ...s, url: e.target.value }))}
                required
              />
              <input
                type="text"
                placeholder="カテゴリ（任意）"
                value={newLink.category}
                onChange={(e) => setNewLink((s) => ({ ...s, category: e.target.value }))}
              />
              <label style={{ fontSize: 12, color: colors.textMuted }}>
                並び順
                <input
                  type="number"
                  value={newLink.sortOrder}
                  onChange={(e) => setNewLink((s) => ({ ...s, sortOrder: e.target.value }))}
                  style={{ display: "block", width: "100%", marginTop: 4 }}
                />
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" disabled={linkSubmitting}>
                  作成する
                </button>
                <button type="button" onClick={() => setShowAddLinkForm(false)}>
                  キャンセル
                </button>
              </div>
            </form>
          )}
          {linkError && <p style={{ color: colors.danger, fontSize: 13 }}>{linkError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 420 }}>
            {[...orgLinks]
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((l) => (
                <li
                  key={l.linkId}
                  style={{ padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
                >
                  {editingLinkId === l.linkId ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input
                        type="text"
                        placeholder="タイトル"
                        value={editingLink.title}
                        onChange={(e) => setEditingLink((s) => ({ ...s, title: e.target.value }))}
                      />
                      <input
                        type="url"
                        placeholder="URL"
                        value={editingLink.url}
                        onChange={(e) => setEditingLink((s) => ({ ...s, url: e.target.value }))}
                      />
                      <input
                        type="text"
                        placeholder="カテゴリ（任意）"
                        value={editingLink.category}
                        onChange={(e) => setEditingLink((s) => ({ ...s, category: e.target.value }))}
                      />
                      <input
                        type="number"
                        value={editingLink.sortOrder}
                        onChange={(e) => setEditingLink((s) => ({ ...s, sortOrder: e.target.value }))}
                      />
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" onClick={() => handleSaveLink(l.linkId)}>
                          保存
                        </button>
                        <button type="button" onClick={() => setEditingLinkId(null)}>
                          キャンセル
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ flex: 1 }}>
                        {l.title}（{l.category ?? "その他"}）
                      </span>
                      <button
                        type="button"
                        onClick={() => startEditLink(l)}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Pencil size={14} /> 編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLink(l.linkId)}
                        style={{ display: "flex", alignItems: "center", gap: 4 }}
                      >
                        <Trash2 size={14} /> 削除
                      </button>
                    </div>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
      {tab === "calendarCategories" && (
        <section>
          <h3>カレンダーカテゴリー管理</h3>
          <form onSubmit={handleAddCalendarCategory} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="カテゴリ名（例：行事）"
              value={newCalendarCategoryName}
              onChange={(e) => setNewCalendarCategoryName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={calendarCategorySubmitting}>
              追加
            </button>
          </form>
          {calendarCategoryError && <p style={{ color: colors.danger, fontSize: 13 }}>{calendarCategoryError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 360 }}>
            {calendarCategories.map((c) => (
              <li
                key={c.categoryId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingCalendarCategoryId === c.categoryId ? (
                  <>
                    <input
                      type="text"
                      value={editingCalendarCategoryName}
                      onChange={(e) => setEditingCalendarCategoryName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveCalendarCategoryName(c.categoryId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingCalendarCategoryId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCalendarCategoryId(c.categoryId);
                        setEditingCalendarCategoryName(c.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCalendarCategory(c.categoryId)}
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
      {tab === "dutyTypes" && (
        <section>
          <h3>当番種別管理</h3>
          <p style={{ fontSize: 13, color: colors.textMuted }}>
            無効化すると新規入力の選択肢から外れます（既存データはそのまま残ります）。
          </p>
          <form onSubmit={handleAddDutyType} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="当番名（例：早出）"
              value={newDutyTypeName}
              onChange={(e) => setNewDutyTypeName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={dutyTypeSubmitting}>
              追加
            </button>
          </form>
          {dutyTypeError && <p style={{ color: colors.danger, fontSize: 13 }}>{dutyTypeError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 420 }}>
            {dutyTypes.map((d) => (
              <li
                key={d.dutyTypeId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingDutyTypeId === d.dutyTypeId ? (
                  <>
                    <input
                      type="text"
                      value={editingDutyTypeName}
                      onChange={(e) => setEditingDutyTypeName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveDutyTypeName(d.dutyTypeId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingDutyTypeId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        onChange={() => handleToggleDutyTypeActive(d.dutyTypeId, d.isActive)}
                      />
                      {d.name}
                      {!d.isActive && <span style={{ color: colors.textMuted, fontSize: 12 }}>（無効）</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingDutyTypeId(d.dutyTypeId);
                        setEditingDutyTypeName(d.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDutyType(d.dutyTypeId)}
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
      {tab === "shiftTypes" && (
        <section>
          <h3>シフト種別管理</h3>
          <p style={{ fontSize: 13, color: colors.textMuted }}>
            無効化すると新規入力の選択肢から外れます（既存データはそのまま残ります）。
          </p>
          <form onSubmit={handleAddShiftType} style={{ display: "flex", gap: 8, maxWidth: 360, marginBottom: 12 }}>
            <input
              type="text"
              placeholder="シフト名（例：早番）"
              value={newShiftTypeName}
              onChange={(e) => setNewShiftTypeName(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button type="submit" disabled={shiftTypeSubmitting}>
              追加
            </button>
          </form>
          {shiftTypeError && <p style={{ color: colors.danger, fontSize: 13 }}>{shiftTypeError}</p>}
          <ul style={{ listStyle: "none", padding: 0, maxWidth: 420 }}>
            {shiftTypes.map((s) => (
              <li
                key={s.shiftTypeId}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${colors.surface}` }}
              >
                {editingShiftTypeId === s.shiftTypeId ? (
                  <>
                    <input
                      type="text"
                      value={editingShiftTypeName}
                      onChange={(e) => setEditingShiftTypeName(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <button type="button" onClick={() => handleSaveShiftTypeName(s.shiftTypeId)}>
                      保存
                    </button>
                    <button type="button" onClick={() => setEditingShiftTypeId(null)}>
                      キャンセル
                    </button>
                  </>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}>
                      <input
                        type="checkbox"
                        checked={s.isActive}
                        onChange={() => handleToggleShiftTypeActive(s.shiftTypeId, s.isActive)}
                      />
                      {s.name}
                      {!s.isActive && <span style={{ color: colors.textMuted, fontSize: 12 }}>（無効）</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingShiftTypeId(s.shiftTypeId);
                        setEditingShiftTypeName(s.name);
                      }}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Pencil size={14} /> 改名
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteShiftType(s.shiftTypeId)}
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
    </div>
  );
}
