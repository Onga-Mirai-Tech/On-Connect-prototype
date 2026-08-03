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
  createdAt: string;
}

export interface BulletinPost {
  postId: string;
  category: string;
  body: string;
  attachmentKeys?: string[];
  authorId: string;
  /** 空配列の場合は全メンバーに公開 */
  visibleCategoryIds: string[];
  createdAt: string;
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
