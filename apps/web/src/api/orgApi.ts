import { fetchAuthSession } from "aws-amplify/auth";
import type { MemberCategory, Role, User } from "@on-connect/shared";

const API_URL = import.meta.env.VITE_API_URL;

export type AdminUser = User & { loginStatus?: string };

class ApiError extends Error {}

/** Cognitoのトークンを付けてREST APIを呼ぶ（Phase 8a: AdminPage内に閉じていたものをPhase 8bで共通化） */
async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  if (!API_URL) throw new ApiError("API未接続");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() ?? "";
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: token, "Content-Type": "application/json" },
  });
}

async function authFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await authFetch(path, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as { message?: string });
    throw new ApiError(body.message ?? `リクエストに失敗しました（${res.status}）`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const orgApi = {
  listUsers: () => authFetchJson<AdminUser[]>("/users"),
  createUser: (input: {
    loginId: string;
    displayName: string;
    furigana: string;
    roleId: string;
    memberCategoryId: string;
  }) =>
    authFetchJson<{ user: AdminUser; temporaryPassword: string }>("/users", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateUser: (userId: string, partial: Partial<User>) =>
    authFetchJson<User>(`/users/${userId}`, { method: "PUT", body: JSON.stringify(partial) }),
  resetPassword: (userId: string) =>
    authFetchJson<{ temporaryPassword: string }>(`/users/${userId}/reset-password`, { method: "POST" }),

  listRoles: () => authFetchJson<Role[]>("/roles"),
  createRole: (name: string) => authFetchJson<Role>("/roles", { method: "POST", body: JSON.stringify({ name }) }),
  updateRole: (roleId: string, name: string) =>
    authFetchJson<Role>(`/roles/${roleId}`, { method: "PUT", body: JSON.stringify({ name }) }),
  deleteRole: (roleId: string) => authFetchJson<void>(`/roles/${roleId}`, { method: "DELETE" }),

  listMemberCategories: () => authFetchJson<MemberCategory[]>("/member-categories"),
  createMemberCategory: (name: string) =>
    authFetchJson<MemberCategory>("/member-categories", { method: "POST", body: JSON.stringify({ name }) }),
  updateMemberCategory: (categoryId: string, name: string) =>
    authFetchJson<MemberCategory>(`/member-categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteMemberCategory: (categoryId: string) =>
    authFetchJson<void>(`/member-categories/${categoryId}`, { method: "DELETE" }),
};
