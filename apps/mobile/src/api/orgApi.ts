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

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export type AdminUser = User & { loginStatus?: string };

class ApiError extends Error {}

/** Cognitoのトークンを付けてREST APIを呼ぶ（Phase 8b）。mobileには管理画面が無いため一覧系リソースは読み取り専用。 */
async function authFetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_URL) throw new ApiError("API未接続");
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString() ?? "";
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: token, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new ApiError(`リクエストに失敗しました（${res.status}）`);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const orgApi = {
  listUsers: () => authFetchJson<AdminUser[]>("/users"),
  listRoles: () => authFetchJson<Role[]>("/roles"),
  listMemberCategories: () => authFetchJson<MemberCategory[]>("/member-categories"),
  listOrgLinks: () => authFetchJson<OrgLink[]>("/org-links"),
  listBulletinCategories: () => authFetchJson<BulletinCategory[]>("/bulletin-categories"),
  listCalendarCategories: () => authFetchJson<CalendarCategory[]>("/calendar-categories"),
  listDutyTypes: () => authFetchJson<DutyType[]>("/duty-types"),
  listShiftTypes: () => authFetchJson<ShiftType[]>("/shift-types"),

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

  // --- 自分自身のプロフィール更新（Phase 13） ---
  updatePushToken: (userId: string, expoPushToken: string | null) =>
    authFetchJson<User>(`/users/${userId}/push-token`, {
      method: "PUT",
      body: JSON.stringify({ expoPushToken }),
    }),
  updateOwnNotificationStatus: (userId: string, notificationStatus: User["notificationStatus"]) =>
    authFetchJson<User>(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify({ notificationStatus }),
    }),
};
