import { fetchAuthSession } from "aws-amplify/auth";
import type { MemberCategory, Role, User } from "@on-connect/shared";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type AdminUser = User & { loginStatus?: string };

class ApiError extends Error {}

/** Cognitoのトークンを付けてREST APIを呼ぶ（Phase 8b）。mobileには管理画面が無いため読み取り専用。 */
async function authFetchJson<T>(path: string): Promise<T> {
  if (!API_URL) throw new ApiError("API未接続");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() ?? "";
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: token } });
  if (!res.ok) throw new ApiError(`リクエストに失敗しました（${res.status}）`);
  return (await res.json()) as T;
}

export const orgApi = {
  listUsers: () => authFetchJson<AdminUser[]>("/users"),
  listRoles: () => authFetchJson<Role[]>("/roles"),
  listMemberCategories: () => authFetchJson<MemberCategory[]>("/member-categories"),
};
