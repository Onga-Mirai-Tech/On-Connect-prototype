import { randomUUID } from "node:crypto";
import type { APIGatewayProxyEvent, APIGatewayProxyHandler } from "aws-lambda";
import { GetCommand, PutCommand, ScanCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import type { MemberCategory, Role, User } from "@on-connect/shared";
import { requirePermission } from "../common/authz";
import { docClient } from "../common/dynamo";
import { HttpError, getCurrentUserId, handleRequest, jsonResponse, parseJsonBody, requireParam } from "../common/http";

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME!;
const ROLES_TABLE_NAME = process.env.ROLES_TABLE_NAME!;
const MEMBER_CATEGORIES_TABLE_NAME = process.env.MEMBER_CATEGORIES_TABLE_NAME!;

/**
 * ユーザー・ロール・メンバーカテゴリ管理API（設計書5.1）。
 * API Gatewayでは /users, /roles, /member-categories の3リソースがすべてこのLambdaに
 * ルーティングされる（それぞれUsers/Roles/MemberCategoriesテーブルへの読み書き権限は付与済み）。
 */
export const handler: APIGatewayProxyHandler = async (event) =>
  handleRequest(async () => {
    const { resource, httpMethod } = event;

    if (resource === "/users") {
      if (httpMethod === "GET") return listUsers();
      if (httpMethod === "POST") return createUser(event);
    }
    if (resource === "/users/{userId}") {
      const userId = requireParam(event, "userId");
      if (httpMethod === "GET") return getUser(userId);
      if (httpMethod === "PUT") return updateUser(userId, event);
      if (httpMethod === "DELETE") return deleteUser(userId, event);
    }
    if (resource === "/roles") {
      if (httpMethod === "GET") return listRoles();
      if (httpMethod === "POST") return createRole(event);
    }
    if (resource === "/roles/{roleId}") {
      const roleId = requireParam(event, "roleId");
      if (httpMethod === "GET") return getRole(roleId);
      if (httpMethod === "PUT") return updateRole(roleId, event);
      if (httpMethod === "DELETE") return deleteRole(roleId, event);
    }
    if (resource === "/member-categories") {
      if (httpMethod === "GET") return listMemberCategories();
      if (httpMethod === "POST") return createMemberCategory(event);
    }
    if (resource === "/member-categories/{categoryId}") {
      const categoryId = requireParam(event, "categoryId");
      if (httpMethod === "GET") return getMemberCategory(categoryId);
      if (httpMethod === "PUT") return updateMemberCategory(categoryId, event);
      if (httpMethod === "DELETE") return deleteMemberCategory(categoryId, event);
    }

    throw new HttpError(404, `対応していないルートです: ${httpMethod} ${resource}`);
  });

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

async function listUsers() {
  const result = await docClient.send(new ScanCommand({ TableName: USERS_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function getUser(userId: string) {
  const user = await fetchUser(userId);
  if (!user) throw new HttpError(404, "ユーザーが見つかりません");
  return jsonResponse(200, user);
}

async function createUser(event: APIGatewayProxyEvent) {
  // Usersテーブルが空(=組織初期セットアップ前)の場合に限り、権限チェック無しで最初の1人を作成できる。
  // それ以外は管理者(manageUsers権限)のみが新規ユーザーを作成できる。
  if (!(await isTableEmpty(USERS_TABLE_NAME))) {
    await requirePermission(event, "manageUsers", USERS_TABLE_NAME, ROLES_TABLE_NAME);
  }

  const input = parseJsonBody<User>(event);
  // userIdはCognitoの発行するsubと一致させる想定のため、作成時は呼び出し側から明示的に指定する。
  for (const field of ["userId", "displayName", "furigana", "email", "roleId", "memberCategoryId"] as const) {
    if (!input[field]) throw new HttpError(400, `${field} は必須です`);
  }

  const existing = await fetchUser(input.userId);
  if (existing) throw new HttpError(409, "このuserIdは既に登録されています");

  const user: User = {
    userId: input.userId,
    displayName: input.displayName,
    furigana: input.furigana,
    email: input.email,
    roleId: input.roleId,
    memberCategoryId: input.memberCategoryId,
    notificationStatus: input.notificationStatus ?? "ON",
    ...(input.className ? { className: input.className } : {}),
  };

  await docClient.send(new PutCommand({ TableName: USERS_TABLE_NAME, Item: user }));
  return jsonResponse(201, user);
}

async function updateUser(userId: string, event: APIGatewayProxyEvent) {
  const input = parseJsonBody<Partial<User>>(event);
  const current = await fetchUser(userId);
  if (!current) throw new HttpError(404, "ユーザーが見つかりません");

  // 自分自身の通知ON/OFF切り替え（設計書5.1.2）だけは、管理者権限が無くても本人が行える。
  // それ以外（他人の更新、自分のロール/カテゴリ変更等）はmanageUsers権限が必要。
  const isSelf = getCurrentUserId(event) === userId;
  const isSelfNotificationToggleOnly = isSelf && Object.keys(input).every((key) => key === "notificationStatus");
  if (!isSelfNotificationToggleOnly) {
    await requirePermission(event, "manageUsers", USERS_TABLE_NAME, ROLES_TABLE_NAME);
  }

  if (input.roleId && input.roleId !== current.roleId) {
    await assertNotRemovingLastAdmin(current, input.roleId);
  }

  const updated: User = {
    ...current,
    ...input,
    userId, // パスパラメータを正とする
  };

  await docClient.send(new PutCommand({ TableName: USERS_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteUser(userId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageUsers", USERS_TABLE_NAME, ROLES_TABLE_NAME);

  const current = await fetchUser(userId);
  if (!current) throw new HttpError(404, "ユーザーが見つかりません");

  await assertNotRemovingLastAdmin(current, undefined);

  await docClient.send(new DeleteCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  return jsonResponse(204, {});
}

async function fetchUser(userId: string): Promise<User | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: USERS_TABLE_NAME, Key: { userId } }));
  return result.Item as User | undefined;
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

async function listRoles() {
  const result = await docClient.send(new ScanCommand({ TableName: ROLES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function getRole(roleId: string) {
  const role = await fetchRole(roleId);
  if (!role) throw new HttpError(404, "ロールが見つかりません");
  return jsonResponse(200, role);
}

async function createRole(event: APIGatewayProxyEvent) {
  // Rolesテーブルが空(=組織初期セットアップ前)の場合に限り、権限チェック無しで最初のロールを作成できる。
  if (!(await isTableEmpty(ROLES_TABLE_NAME))) {
    await requirePermission(event, "manageRoles", USERS_TABLE_NAME, ROLES_TABLE_NAME);
  }

  const input = parseJsonBody<Omit<Role, "roleId"> & { roleId?: string }>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");
  if (!input.permissions) throw new HttpError(400, "permissions は必須です");

  const roleId = input.roleId ?? randomId("role");
  const existing = await fetchRole(roleId);
  if (existing) throw new HttpError(409, "このroleIdは既に登録されています");

  const role: Role = { roleId, name: input.name, permissions: input.permissions };
  await docClient.send(new PutCommand({ TableName: ROLES_TABLE_NAME, Item: role }));
  return jsonResponse(201, role);
}

async function updateRole(roleId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageRoles", USERS_TABLE_NAME, ROLES_TABLE_NAME);

  const input = parseJsonBody<Partial<Role>>(event);
  const current = await fetchRole(roleId);
  if (!current) throw new HttpError(404, "ロールが見つかりません");

  // manageUsers権限を剥奪しようとしている場合、それが最後の管理者ロールでないか確認する。
  if (input.permissions && current.permissions.manageUsers && !input.permissions.manageUsers) {
    // このロール以外でmanageUsers権限を持つユーザー数。0人なら他に管理者がいないため拒否する。
    const otherAdminCount = await countUsersWithManageUsersRole(roleId);
    if (otherAdminCount === 0) {
      throw new HttpError(
        409,
        "このロールの管理者権限を外すと管理者が0人になるため変更できません",
      );
    }
  }

  const updated: Role = { ...current, ...input, roleId };
  await docClient.send(new PutCommand({ TableName: ROLES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteRole(roleId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageRoles", USERS_TABLE_NAME, ROLES_TABLE_NAME);

  const current = await fetchRole(roleId);
  if (!current) throw new HttpError(404, "ロールが見つかりません");

  const usersWithRole = await docClient.send(
    new ScanCommand({
      TableName: USERS_TABLE_NAME,
      FilterExpression: "roleId = :roleId",
      ExpressionAttributeValues: { ":roleId": roleId },
      ProjectionExpression: "userId",
    }),
  );
  if ((usersWithRole.Items ?? []).length > 0) {
    throw new HttpError(409, "このロールは現在ユーザーに割り当てられているため削除できません");
  }

  await docClient.send(new DeleteCommand({ TableName: ROLES_TABLE_NAME, Key: { roleId } }));
  return jsonResponse(204, {});
}

async function fetchRole(roleId: string): Promise<Role | undefined> {
  const result = await docClient.send(new GetCommand({ TableName: ROLES_TABLE_NAME, Key: { roleId } }));
  return result.Item as Role | undefined;
}

// ---------------------------------------------------------------------------
// Member categories
// ---------------------------------------------------------------------------

async function listMemberCategories() {
  const result = await docClient.send(new ScanCommand({ TableName: MEMBER_CATEGORIES_TABLE_NAME }));
  return jsonResponse(200, result.Items ?? []);
}

async function getMemberCategory(categoryId: string) {
  const category = await fetchMemberCategory(categoryId);
  if (!category) throw new HttpError(404, "メンバーカテゴリが見つかりません");
  return jsonResponse(200, category);
}

async function createMemberCategory(event: APIGatewayProxyEvent) {
  // MemberCategoriesテーブルが空(=組織初期セットアップ前)の場合に限り、権限チェック無しで作成できる。
  if (!(await isTableEmpty(MEMBER_CATEGORIES_TABLE_NAME))) {
    await requirePermission(event, "manageMemberCategories", USERS_TABLE_NAME, ROLES_TABLE_NAME);
  }

  const input = parseJsonBody<Omit<MemberCategory, "categoryId"> & { categoryId?: string }>(event);
  if (!input.name) throw new HttpError(400, "name は必須です");

  const categoryId = input.categoryId ?? randomId("category");
  const existing = await fetchMemberCategory(categoryId);
  if (existing) throw new HttpError(409, "このcategoryIdは既に登録されています");

  const category: MemberCategory = { categoryId, name: input.name };
  await docClient.send(new PutCommand({ TableName: MEMBER_CATEGORIES_TABLE_NAME, Item: category }));
  return jsonResponse(201, category);
}

async function updateMemberCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageMemberCategories", USERS_TABLE_NAME, ROLES_TABLE_NAME);

  const input = parseJsonBody<Partial<MemberCategory>>(event);
  const current = await fetchMemberCategory(categoryId);
  if (!current) throw new HttpError(404, "メンバーカテゴリが見つかりません");

  const updated: MemberCategory = { ...current, ...input, categoryId };
  await docClient.send(new PutCommand({ TableName: MEMBER_CATEGORIES_TABLE_NAME, Item: updated }));
  return jsonResponse(200, updated);
}

async function deleteMemberCategory(categoryId: string, event: APIGatewayProxyEvent) {
  await requirePermission(event, "manageMemberCategories", USERS_TABLE_NAME, ROLES_TABLE_NAME);

  const current = await fetchMemberCategory(categoryId);
  if (!current) throw new HttpError(404, "メンバーカテゴリが見つかりません");

  const usersWithCategory = await docClient.send(
    new ScanCommand({
      TableName: USERS_TABLE_NAME,
      FilterExpression: "memberCategoryId = :categoryId",
      ExpressionAttributeValues: { ":categoryId": categoryId },
      ProjectionExpression: "userId",
    }),
  );
  if ((usersWithCategory.Items ?? []).length > 0) {
    throw new HttpError(
      409,
      "このメンバーカテゴリは現在ユーザーに割り当てられているため削除できません",
    );
  }

  await docClient.send(new DeleteCommand({ TableName: MEMBER_CATEGORIES_TABLE_NAME, Key: { categoryId } }));
  return jsonResponse(204, {});
}

async function fetchMemberCategory(categoryId: string): Promise<MemberCategory | undefined> {
  const result = await docClient.send(
    new GetCommand({ TableName: MEMBER_CATEGORIES_TABLE_NAME, Key: { categoryId } }),
  );
  return result.Item as MemberCategory | undefined;
}

// ---------------------------------------------------------------------------
// 「最後の1名の管理者は削除・降格できない」ガード（設計書5.1.3）
// ---------------------------------------------------------------------------

/**
 * targetUser を削除する、または targetUser のロールを newRoleId に変更することで
 * manageUsers権限を持つユーザーが0人になってしまう場合に 409 を投げる。
 */
async function assertNotRemovingLastAdmin(targetUser: User, newRoleId: string | undefined) {
  const currentRole = await fetchRole(targetUser.roleId);
  const isCurrentlyAdmin = currentRole?.permissions.manageUsers ?? false;
  if (!isCurrentlyAdmin) return; // そもそも管理者権限を持っていないため対象外

  if (newRoleId) {
    const newRole = await fetchRole(newRoleId);
    if (newRole?.permissions.manageUsers) return; // 変更後も管理者権限を保持するため問題なし
  }

  const remainingAdmins = await countUsersWithManageUsersRole(undefined, targetUser.userId);
  if (remainingAdmins === 0) {
    throw new HttpError(409, "最後の1名の管理者を削除・降格することはできません");
  }
}

/**
 * manageUsers権限を持つロールが割り当てられているユーザー数を数える。
 * excludeRoleId: このロールへの割り当ては管理者としてカウントしない（ロール自体の権限剥奪チェック用）
 * excludeUserId: このユーザーは管理者としてカウントしない（ユーザー削除・降格チェック用）
 */
async function countUsersWithManageUsersRole(excludeRoleId?: string, excludeUserId?: string): Promise<number> {
  const rolesResult = await docClient.send(new ScanCommand({ TableName: ROLES_TABLE_NAME }));
  const adminRoleIds = new Set(
    (rolesResult.Items as Role[] | undefined ?? [])
      .filter((r) => r.permissions.manageUsers && r.roleId !== excludeRoleId)
      .map((r) => r.roleId),
  );
  if (adminRoleIds.size === 0) return 0;

  const usersResult = await docClient.send(new ScanCommand({ TableName: USERS_TABLE_NAME }));
  const users = (usersResult.Items as User[] | undefined) ?? [];
  return users.filter((u) => u.userId !== excludeUserId && adminRoleIds.has(u.roleId)).length;
}

function randomId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

/** 組織初期セットアップ前かどうかの判定に使う（テーブルが完全に空か）。 */
async function isTableEmpty(tableName: string): Promise<boolean> {
  const result = await docClient.send(new ScanCommand({ TableName: tableName, Limit: 1 }));
  return (result.Items ?? []).length === 0;
}
