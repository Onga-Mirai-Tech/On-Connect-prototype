import { fetchAuthSession } from "aws-amplify/auth";
import type {
  AttachmentContext,
  AttachmentRef,
  BulletinCategory,
  BulletinComment,
  BulletinPost,
  CalendarCategory,
  CalendarEvent,
  DailyNote,
  DutyType,
  MemberCategory,
  MemberDailyStatus,
  OrgLink,
  Role,
  ShiftType,
  User,
} from "@on-connect/shared";

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

  listOrgLinks: () => authFetchJson<OrgLink[]>("/org-links"),
  createOrgLink: (input: { title: string; url: string; category?: string; sortOrder?: number }) =>
    authFetchJson<OrgLink>("/org-links", { method: "POST", body: JSON.stringify(input) }),
  updateOrgLink: (linkId: string, partial: Partial<OrgLink>) =>
    authFetchJson<OrgLink>(`/org-links/${linkId}`, { method: "PUT", body: JSON.stringify(partial) }),
  deleteOrgLink: (linkId: string) => authFetchJson<void>(`/org-links/${linkId}`, { method: "DELETE" }),

  listBulletinCategories: () => authFetchJson<BulletinCategory[]>("/bulletin-categories"),
  createBulletinCategory: (name: string) =>
    authFetchJson<BulletinCategory>("/bulletin-categories", { method: "POST", body: JSON.stringify({ name }) }),
  updateBulletinCategory: (categoryId: string, name: string) =>
    authFetchJson<BulletinCategory>(`/bulletin-categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteBulletinCategory: (categoryId: string) =>
    authFetchJson<void>(`/bulletin-categories/${categoryId}`, { method: "DELETE" }),

  listBulletinPosts: () => authFetchJson<BulletinPost[]>("/bulletin-posts"),
  getBulletinPost: (postId: string) => authFetchJson<BulletinPost>(`/bulletin-posts/${postId}`),
  createBulletinPost: (input: {
    title: string;
    body: string;
    categoryId?: string;
    visibleCategoryIds?: string[];
    attachments?: AttachmentRef[];
  }) => authFetchJson<BulletinPost>("/bulletin-posts", { method: "POST", body: JSON.stringify(input) }),
  updateBulletinPost: (postId: string, partial: Partial<BulletinPost>) =>
    authFetchJson<BulletinPost>(`/bulletin-posts/${postId}`, { method: "PUT", body: JSON.stringify(partial) }),
  deleteBulletinPost: (postId: string) => authFetchJson<void>(`/bulletin-posts/${postId}`, { method: "DELETE" }),
  listBulletinComments: (postId: string) => authFetchJson<BulletinComment[]>(`/bulletin-posts/${postId}/comments`),
  createBulletinComment: (postId: string, body: string) =>
    authFetchJson<BulletinComment>(`/bulletin-posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body }),
    }),
  toggleBulletinPostReaction: (postId: string, emoji: string) =>
    authFetchJson<BulletinPost>(`/bulletin-posts/${postId}/reactions`, {
      method: "PUT",
      body: JSON.stringify({ emoji }),
    }),

  listCalendarCategories: () => authFetchJson<CalendarCategory[]>("/calendar-categories"),
  createCalendarCategory: (name: string) =>
    authFetchJson<CalendarCategory>("/calendar-categories", { method: "POST", body: JSON.stringify({ name }) }),
  updateCalendarCategory: (categoryId: string, name: string) =>
    authFetchJson<CalendarCategory>(`/calendar-categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    }),
  deleteCalendarCategory: (categoryId: string) =>
    authFetchJson<void>(`/calendar-categories/${categoryId}`, { method: "DELETE" }),

  listCalendarEvents: () => authFetchJson<CalendarEvent[]>("/calendar-events"),
  getCalendarEvent: (eventId: string) => authFetchJson<CalendarEvent>(`/calendar-events/${eventId}`),
  createCalendarEvent: (input: {
    title: string;
    startAt: string;
    endAt: string;
    description?: string;
    categoryId?: string;
    visibleCategoryIds?: string[];
  }) => authFetchJson<CalendarEvent>("/calendar-events", { method: "POST", body: JSON.stringify(input) }),
  updateCalendarEvent: (eventId: string, partial: Partial<CalendarEvent>) =>
    authFetchJson<CalendarEvent>(`/calendar-events/${eventId}`, { method: "PUT", body: JSON.stringify(partial) }),
  deleteCalendarEvent: (eventId: string) => authFetchJson<void>(`/calendar-events/${eventId}`, { method: "DELETE" }),

  listDutyTypes: () => authFetchJson<DutyType[]>("/duty-types"),
  createDutyType: (name: string) =>
    authFetchJson<DutyType>("/duty-types", { method: "POST", body: JSON.stringify({ name }) }),
  updateDutyType: (dutyTypeId: string, partial: Partial<DutyType>) =>
    authFetchJson<DutyType>(`/duty-types/${dutyTypeId}`, { method: "PUT", body: JSON.stringify(partial) }),
  deleteDutyType: (dutyTypeId: string) => authFetchJson<void>(`/duty-types/${dutyTypeId}`, { method: "DELETE" }),

  listShiftTypes: () => authFetchJson<ShiftType[]>("/shift-types"),
  createShiftType: (name: string) =>
    authFetchJson<ShiftType>("/shift-types", { method: "POST", body: JSON.stringify({ name }) }),
  updateShiftType: (shiftTypeId: string, partial: Partial<ShiftType>) =>
    authFetchJson<ShiftType>(`/shift-types/${shiftTypeId}`, { method: "PUT", body: JSON.stringify(partial) }),
  deleteShiftType: (shiftTypeId: string) => authFetchJson<void>(`/shift-types/${shiftTypeId}`, { method: "DELETE" }),

  listMemberDailyStatusesForDate: (date: string) =>
    authFetchJson<MemberDailyStatus[]>(`/member-daily-status?date=${date}`),
  updateMemberDailyStatus: (date: string, userId: string, partial: Partial<MemberDailyStatus>) =>
    authFetchJson<MemberDailyStatus>(`/member-daily-status/${date}/${userId}`, {
      method: "PUT",
      body: JSON.stringify(partial),
    }),
  deleteMemberDailyStatus: (date: string, userId: string) =>
    authFetchJson<void>(`/member-daily-status/${date}/${userId}`, { method: "DELETE" }),

  getDailyNote: (date: string) => authFetchJson<DailyNote>(`/daily-notes/${date}`),
  updateDailyNote: (date: string, note: string) =>
    authFetchJson<DailyNote>(`/daily-notes/${date}`, { method: "PUT", body: JSON.stringify({ note }) }),
  deleteDailyNote: (date: string) => authFetchJson<void>(`/daily-notes/${date}`, { method: "DELETE" }),

  // --- チャット・掲示板の添付ファイル（Phase 12） ---
  requestUploadUrl: (input: {
    context: AttachmentContext;
    ownerId: string;
    fileName: string;
    contentType: string;
    size: number;
  }) =>
    authFetchJson<{ uploadUrl: string; attachment: AttachmentRef }>("/attachments/upload-url", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  requestDownloadUrl: (input: { context: AttachmentContext; ownerId: string; key: string }) =>
    authFetchJson<{ downloadUrl: string; expiresInSeconds: number }>("/attachments/download-url", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
