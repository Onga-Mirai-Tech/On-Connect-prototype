/**
 * On-Connect ドメイン型定義
 * docs/DESIGN.md 8章「データ設計（主要テーブル例）」に対応
 */

export type NotificationStatus = "ON" | "OFF";

/** ロールごとにON/OFF編集可能な権限フラグ（初期セットの一例） */
export interface RolePermissions {
  manageUsers: boolean;
  sendForceNotify: boolean;
  manageBulletinCategories: boolean;
  manageOrgLinks: boolean;
  manageRoles: boolean;
  manageMemberCategories: boolean;
}

export interface Role {
  roleId: string;
  name: string;
  permissions: RolePermissions;
}

export interface MemberCategory {
  categoryId: string;
  name: string;
}

export interface User {
  userId: string;
  displayName: string;
  /** ふりがな（ひらがな表記）。氏名でのひらがな検索・五十音順ソートに使用する。 */
  furigana: string;
  email: string;
  roleId: string;
  memberCategoryId: string;
  notificationStatus: NotificationStatus;
  className?: string;
}

export type MessageStatus = "scheduled" | "sent";

/** 絵文字リアクション（チャットメッセージ・掲示板投稿で共通利用） */
export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface ChatRoom {
  roomId: string;
  isGroup: boolean;
  name?: string;
  memberUserIds: string[];
  createdAt: string;
}

export interface Message {
  messageId: string;
  roomId: string;
  senderId: string;
  body: string;
  attachmentKeys?: string[];
  readByUserIds: string[];
  status: MessageStatus;
  scheduledAt?: string;
  /** 緊急通知フラグ：通知OFFのユーザーにも強制配信する（音声通話には適用しない） */
  forceNotify: boolean;
  reactions?: Reaction[];
  createdAt: string;
}

export interface BulletinPost {
  postId: string;
  title: string;
  category: string;
  /** HTML編集に対応した本文（保存・表示ともにHTML文字列）。表示側でのサニタイズが必須。 */
  body: string;
  attachmentKeys?: string[];
  authorId: string;
  /** 空配列の場合は全メンバーに公開 */
  visibleCategoryIds: string[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}

export interface BulletinComment {
  commentId: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface ScheduleCacheEvent {
  eventId: string;
  calendarId: string;
  title: string;
  startAt: string;
  endAt: string;
}

/**
 * 表示するGoogleカレンダーの設定（OrgSettingsテーブル、settingId: "googleCalendar"）。
 * サービスアカウント方式を前提とし、対象カレンダーをサービスアカウントのメールアドレスへ
 * 読み取り専用共有した上で、ここにカレンダーIDを設定する（メンバー個々のOAuth認可は不要）。
 * 共有カレンダーの管理・編集自体はGoogleカレンダー側で行い、アプリ内は閲覧専用とする。
 */
export interface GoogleCalendarSetting {
  settingId: "googleCalendar";
  calendarId: string;
  updatedBy: string;
  updatedAt: string;
}

export type CallStatus = "completed" | "missed" | "declined";

export interface CallLog {
  callId: string;
  callerId: string;
  calleeId: string;
  startTime: string;
  endTime?: string;
  durationSeconds?: number;
  status: CallStatus;
}

export interface OrgLink {
  linkId: string;
  title: string;
  url: string;
  category?: string;
  sortOrder: number;
  createdBy: string;
  updatedAt: string;
}
