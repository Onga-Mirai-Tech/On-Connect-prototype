/**
 * On-Connect ドメイン型定義
 * docs/DESIGN.md 8章「データ設計（主要テーブル例）」に対応
 */

export type NotificationStatus = "ON" | "OFF";

/**
 * メンバー1人1人が個別に持つ権限フラグ。
 * ロール(Role)には紐づかず、Userレコード自体が実効的な権限を持つ（新規作成時は全項目false）。
 */
export interface RolePermissions {
  manageUsers: boolean;
  sendForceNotify: boolean;
  manageBulletinCategories: boolean;
  manageOrgLinks: boolean;
  manageRoles: boolean;
  manageMemberCategories: boolean;
  manageCalendarCategories: boolean;
  manageShifts: boolean;
}

/** 役職などの表示ラベル。権限は持たない（権限は`User.permissions`が個別に持つ） */
export interface Role {
  roleId: string;
  name: string;
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
  permissions: RolePermissions;
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
  /** グループチャットでのメンション先。指定時は名指しされた人にのみ通知が届く（forceNotifyが優先） */
  mentionedUserIds?: string[];
  reactions?: Reaction[];
  createdAt: string;
}

/** 掲示板の表示カテゴリー一覧（管理者=manageBulletinCategories権限を持つ人のみ追加・編集・削除可） */
export interface BulletinCategory {
  categoryId: string;
  name: string;
}

export interface BulletinPost {
  postId: string;
  title: string;
  /** BulletinCategoriesを参照する表示カテゴリー（未設定可） */
  categoryId?: string;
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

/** カレンダーの表示カテゴリー一覧（管理者=manageCalendarCategories権限を持つ人のみ追加・編集・削除可） */
export interface CalendarCategory {
  categoryId: string;
  name: string;
}

/**
 * 独立DBで管理する共有カレンダーの予定。Googleカレンダーとは同期しない。
 * 全メンバーが作成・編集・削除できる（バックエンドでの権限チェックは無く、削除前の確認はフロント側の責務）。
 */
export interface CalendarEvent {
  eventId: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  /** CalendarCategoriesを参照する表示カテゴリー（未設定可） */
  categoryId?: string;
  /** 空配列の場合は全メンバーに公開（BulletinPost.visibleCategoryIdsと同じ、職員カテゴリー単位の閲覧権限） */
  visibleCategoryIds: string[];
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType = "FULL" | "AM" | "PM";
/** 希望休（本人希望）か指定休（会社都合）かの記録用区分。通知OFF判定のロジックには影響しない */
export type LeaveReason = "REQUESTED" | "ASSIGNED";

/** 当番の種類一覧（例：早出／日直／1F見守）。manageShifts権限を持つ人のみ追加・編集・削除可 */
export interface DutyType {
  dutyTypeId: string;
  name: string;
  /** falseの場合、新規入力時の選択肢から外れる（学期中/長期休暇でコード体系が変わるため）。既存データはそのまま残る */
  isActive: boolean;
}

/** シフトの種類一覧（例：早番／遅番、にこ1（朝）等）。manageShifts権限を持つ人のみ追加・編集・削除可 */
export interface ShiftType {
  shiftTypeId: string;
  name: string;
  isActive: boolean;
}

/**
 * メンバー1人・1日ごとの休日／当番／シフトの記録。全項目、manageShifts権限を持つ人のみが編集できる
 * （本人の分であっても自己申告はできない）。閲覧は全メンバーに開放する。
 */
export interface MemberDailyStatus {
  date: string; // YYYY-MM-DD
  userId: string;
  leaveType?: LeaveType;
  /** leaveTypeが設定されている場合のみ意味を持つ */
  leaveReason?: LeaveReason;
  /** 午前のシフト（ShiftTypesを参照）。1日通しの場合はpmShiftTypeIdと同じ値を入れる */
  amShiftTypeId?: string;
  /** 午後のシフト（ShiftTypesを参照） */
  pmShiftTypeId?: string;
  /** その日の当番（DutyTypesを参照、複数の当番を兼務できるため配列） */
  dutyTypeIds?: string[];
  updatedAt: string;
  updatedBy: string;
}

/**
 * 日付単位（メンバーには紐づかない）の自由メモ。「今日は避難訓練あり」のような、その日全体に関する
 * 備考を想定。manageShifts権限を持つ人のみ追記・編集できる。
 */
export interface DailyNote {
  date: string; // YYYY-MM-DD
  note: string;
  updatedAt: string;
  updatedBy: string;
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
