import type {
  User,
  Role,
  RolePermissions,
  MemberCategory,
  ChatRoom,
  Message,
  BulletinPost,
  BulletinComment,
  BulletinCategory,
  CalendarEvent,
  CalendarCategory,
  DutyType,
  ShiftType,
  MemberDailyStatus,
  DailyNote,
  OrgLink,
  Reaction,
} from "./types";

/** チャット・掲示板で共通利用するリアクション用の絵文字パレット */
export const reactionEmojis = ["👍", "❤️", "😂", "😮", "😢"];

/**
 * リアクションの追加・解除を行う純粋関数（チャット・掲示板で共通利用）。
 * 対象の絵文字リアクションが無ければ新規作成、あれば自分の参加をトグルする。
 * トグルの結果、参加者が0人になったリアクションは配列から取り除く。
 */
export const toggleReaction = (reactions: Reaction[] | undefined, emoji: string, userId: string): Reaction[] => {
  const list = reactions ? reactions.map((r) => ({ ...r, userIds: [...r.userIds] })) : [];
  const idx = list.findIndex((r) => r.emoji === emoji);
  if (idx === -1) {
    list.push({ emoji, userIds: [userId] });
    return list;
  }
  const hasReacted = list[idx].userIds.includes(userId);
  list[idx].userIds = hasReacted
    ? list[idx].userIds.filter((id) => id !== userId)
    : [...list[idx].userIds, userId];
  if (list[idx].userIds.length === 0) {
    list.splice(idx, 1);
  }
  return list;
};

/**
 * 機能デモ用のダミーデータ。
 * バックエンド（AWS）が未接続の段階でも、メンバー一覧・チャット・掲示板・カレンダー・
 * リンク集の見え方を確認できるようにするためのモックであり、実データではない。
 * `apps/web` `apps/mobile` の各ページから直接importして表示に使う。
 * カレンダーはGoogleカレンダーとは同期しない独立DB管理で、全メンバーが作成・編集できる。
 */

/** デモ上の「ログイン中の自分」 */
export const mockCurrentUserId = "user-03";

export const mockMemberCategories: MemberCategory[] = [
  { categoryId: "cat-regular", name: "正職員" },
  { categoryId: "cat-contract", name: "契約職員" },
  { categoryId: "cat-parttime", name: "パート・アルバイト" },
  { categoryId: "cat-external", name: "外部職員" },
];

export const mockRoles: Role[] = [
  { roleId: "role-admin", name: "管理者" },
  { roleId: "role-general", name: "一般メンバー" },
];

const allPermissionsOn: RolePermissions = {
  manageUsers: true,
  sendForceNotify: true,
  manageBulletinCategories: true,
  manageOrgLinks: true,
  manageRoles: true,
  manageMemberCategories: true,
  manageCalendarCategories: true,
  manageShifts: true,
};

const allPermissionsOff: RolePermissions = {
  manageUsers: false,
  sendForceNotify: false,
  manageBulletinCategories: false,
  manageOrgLinks: false,
  manageRoles: false,
  manageMemberCategories: false,
  manageCalendarCategories: false,
  manageShifts: false,
};

export const mockMembers: User[] = [
  {
    userId: "user-01",
    displayName: "佐藤 陽子",
    furigana: "さとう ようこ",
    email: "sato@on-connect.example.com",
    roleId: "role-admin",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
    permissions: allPermissionsOn,
  },
  {
    userId: "user-02",
    displayName: "高橋 誠",
    furigana: "たかはし まこと",
    email: "takahashi@on-connect.example.com",
    roleId: "role-admin",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
    permissions: allPermissionsOn,
  },
  {
    userId: "user-03",
    displayName: "田中 美咲",
    furigana: "たなか みさき",
    email: "tanaka@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
    permissions: allPermissionsOff,
    className: "ひまわり組",
  },
  {
    userId: "user-04",
    displayName: "鈴木 健太",
    furigana: "すずき けんた",
    email: "suzuki@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-regular",
    notificationStatus: "OFF",
    permissions: allPermissionsOff,
    className: "さくら組",
  },
  {
    userId: "user-05",
    displayName: "伊藤 有紀",
    furigana: "いとう ゆき",
    email: "ito@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-contract",
    notificationStatus: "ON",
    permissions: allPermissionsOff,
    className: "たんぽぽ組",
  },
  {
    userId: "user-06",
    displayName: "渡辺 舞",
    furigana: "わたなべ まい",
    email: "watanabe@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-parttime",
    notificationStatus: "OFF",
    permissions: allPermissionsOff,
    className: "うさぎ組（延長保育）",
  },
  {
    userId: "user-07",
    displayName: "山本 大輔",
    furigana: "やまもと だいすけ",
    email: "yamamoto@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-parttime",
    notificationStatus: "ON",
    permissions: allPermissionsOff,
  },
  {
    userId: "user-08",
    displayName: "中村 恵子",
    furigana: "なかむら けいこ",
    email: "nakamura@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-external",
    notificationStatus: "OFF",
    permissions: allPermissionsOff,
  },
  {
    userId: "user-09",
    displayName: "小林 直樹",
    furigana: "こばやし なおき",
    email: "kobayashi@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
    permissions: allPermissionsOff,
  },
];

/**
 * メンバー検索の判定ロジック（氏名・ふりがなの部分一致、大文字小文字は区別しない）。
 * 氏名検索窓とふりがな（ひらがな）検索の両方から共通で利用する。
 */
export const memberMatchesQuery = (member: User, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return member.displayName.toLowerCase().includes(q) || member.furigana.toLowerCase().includes(q);
};

/**
 * デモ用：「ログイン中の自分」が管理者権限を持つかどうか。
 * 本来はCognito認証後にUsersテーブルの本人のpermissionsを参照して判定するが、
 * 認証未実装の現段階ではダミーデータから算出する（管理者タブの表示制御に使用）。
 */
export const mockCurrentUserIsAdmin = (() => {
  const currentMember = mockMembers.find((m) => m.userId === mockCurrentUserId);
  return currentMember?.permissions.manageUsers ?? false;
})();

export const mockChatRooms: ChatRoom[] = [
  {
    roomId: "room-dm-01-02",
    isGroup: false,
    memberUserIds: ["user-01", "user-03"],
    createdAt: "2026-07-20T09:00:00+09:00",
  },
  {
    roomId: "room-dm-03-04",
    isGroup: false,
    memberUserIds: ["user-03", "user-04"],
    createdAt: "2026-07-22T10:00:00+09:00",
  },
  {
    roomId: "room-group-himawari",
    isGroup: true,
    name: "GC_ひまわり組連絡",
    memberUserIds: ["user-01", "user-03", "user-05", "user-06"],
    createdAt: "2026-06-01T09:00:00+09:00",
  },
  {
    roomId: "room-group-all",
    isGroup: true,
    name: "GC_全体連絡",
    memberUserIds: mockMembers.map((m) => m.userId),
    createdAt: "2026-04-01T09:00:00+09:00",
  },
];

export const mockMessages: Record<string, Message[]> = {
  "room-dm-01-02": [
    {
      messageId: "msg-1",
      roomId: "room-dm-01-02",
      senderId: "user-01",
      body: "田中先生、来週の保護者面談の件で少しお時間いただけますか。",
      readByUserIds: ["user-01", "user-03"],
      status: "sent",
      forceNotify: false,
      createdAt: "2026-08-01T17:30:00+09:00",
    },
    {
      messageId: "msg-2",
      roomId: "room-dm-01-02",
      senderId: "user-03",
      body: "大丈夫です！明日の午後でしたらお時間取れます。",
      readByUserIds: ["user-01", "user-03"],
      status: "sent",
      forceNotify: false,
      reactions: [{ emoji: "👍", userIds: ["user-01"] }],
      createdAt: "2026-08-01T18:02:00+09:00",
    },
  ],
  "room-dm-03-04": [
    {
      messageId: "msg-3",
      roomId: "room-dm-03-04",
      senderId: "user-03",
      body: "鈴木さん、さくら組の午睡用布団の在庫確認お願いできますか？",
      readByUserIds: ["user-03"],
      status: "sent",
      forceNotify: false,
      createdAt: "2026-08-02T14:10:00+09:00",
    },
  ],
  "room-group-himawari": [
    {
      messageId: "msg-4",
      roomId: "room-group-himawari",
      senderId: "user-01",
      body: "来週の遠足、持ち物リストを掲示板に載せました。ご確認ください。",
      readByUserIds: ["user-01", "user-03", "user-05"],
      status: "sent",
      forceNotify: false,
      createdAt: "2026-08-02T09:15:00+09:00",
    },
    {
      messageId: "msg-5",
      roomId: "room-group-himawari",
      senderId: "user-05",
      body: "承知しました。園児にも伝えておきます。",
      readByUserIds: ["user-01", "user-05"],
      status: "sent",
      forceNotify: false,
      reactions: [{ emoji: "👍", userIds: ["user-01", "user-03"] }],
      createdAt: "2026-08-02T09:40:00+09:00",
    },
  ],
  "room-group-all": [
    {
      messageId: "msg-6",
      roomId: "room-group-all",
      senderId: "user-01",
      body: "台風接近に伴い、明日8/4は臨時休園とします。詳細は掲示板を確認してください。",
      readByUserIds: ["user-01", "user-03", "user-07", "user-09"],
      status: "sent",
      forceNotify: true,
      createdAt: "2026-08-03T20:00:00+09:00",
    },
  ],
};

export const mockBulletinCategories: BulletinCategory[] = [
  { categoryId: "bc-announcement", name: "お知らせ" },
  { categoryId: "bc-event", name: "行事" },
  { categoryId: "bc-emergency", name: "緊急連絡" },
];

export const mockBulletinPosts: BulletinPost[] = [
  {
    postId: "post-01",
    title: "【重要】台風接近に伴う臨時休園のお知らせ",
    categoryId: "bc-emergency",
    body: "<p><strong>台風接近</strong>に伴い、明日8/4（火）は臨時休園といたします。</p><p>今後の予定は追ってご連絡します。</p>",
    authorId: "user-01",
    visibleCategoryIds: [],
    reactions: [{ emoji: "😮", userIds: ["user-03", "user-04", "user-07"] }],
    createdAt: "2026-08-03T20:00:00+09:00",
    updatedAt: "2026-08-03T20:00:00+09:00",
  },
  {
    postId: "post-02",
    title: "夏祭り開催のお知らせ（ボランティア募集）",
    categoryId: "bc-event",
    body: "<p>8/8（土）に夏祭りを開催します。</p><p>ボランティアメンバーを募集していますので、参加可能な方はリンク集のフォームよりご回答ください。</p>",
    authorId: "user-02",
    visibleCategoryIds: [],
    reactions: [{ emoji: "👍", userIds: ["user-01", "user-03", "user-05", "user-09"] }],
    createdAt: "2026-07-28T10:00:00+09:00",
    updatedAt: "2026-07-28T10:00:00+09:00",
  },
  {
    postId: "post-03",
    title: "契約更新に関する面談のご案内",
    categoryId: "bc-announcement",
    body: "<p>契約更新に関する面談を8月中に実施します。</p><p>対象の方には別途日程調整のご連絡をします。</p>",
    authorId: "user-01",
    visibleCategoryIds: ["cat-contract"],
    createdAt: "2026-07-25T13:00:00+09:00",
    updatedAt: "2026-07-25T13:00:00+09:00",
  },
  {
    postId: "post-04",
    title: "定例会議 議事録の共有",
    categoryId: "bc-announcement",
    body: "<p>定例会議の議事録を共有します。</p><ul><li>次回は8/5（水）17:30〜</li><li>会場：職員室</li></ul>",
    authorId: "user-02",
    visibleCategoryIds: ["cat-regular", "cat-contract"],
    createdAt: "2026-07-29T18:00:00+09:00",
    updatedAt: "2026-07-29T18:00:00+09:00",
  },
  {
    postId: "post-05",
    title: "運動会開催のお知らせ（9/20）",
    categoryId: "bc-event",
    body: "<p>運動会は9/20（日）を予定しています。</p><p>会場設営の詳細は追ってお知らせします。</p>",
    authorId: "user-01",
    visibleCategoryIds: [],
    createdAt: "2026-07-15T09:00:00+09:00",
    updatedAt: "2026-07-15T09:00:00+09:00",
  },
];

export const mockBulletinComments: BulletinComment[] = [
  {
    commentId: "comment-01",
    postId: "post-01",
    authorId: "user-03",
    body: "承知しました。園児の保護者にも周知します。",
    createdAt: "2026-08-03T20:15:00+09:00",
  },
  {
    commentId: "comment-02",
    postId: "post-02",
    authorId: "user-05",
    body: "午前中のシフトで参加できます！",
    createdAt: "2026-07-28T11:00:00+09:00",
  },
  {
    commentId: "comment-03",
    postId: "post-02",
    authorId: "user-09",
    body: "設営のお手伝いします。",
    createdAt: "2026-07-28T12:30:00+09:00",
  },
];

export const mockCalendarCategories: CalendarCategory[] = [
  { categoryId: "cc-meeting", name: "会議" },
  { categoryId: "cc-event", name: "行事" },
  { categoryId: "cc-personal", name: "個人予定" },
];

export const mockCalendarEvents: CalendarEvent[] = [
  {
    eventId: "evt-01",
    title: "定例会議",
    categoryId: "cc-meeting",
    startAt: "2026-08-05T17:30:00+09:00",
    endAt: "2026-08-05T18:30:00+09:00",
    visibleCategoryIds: [],
    authorId: "user-01",
    createdAt: "2026-07-20T09:00:00+09:00",
    updatedAt: "2026-07-20T09:00:00+09:00",
  },
  {
    eventId: "evt-02",
    title: "夏祭り",
    categoryId: "cc-event",
    startAt: "2026-08-08T10:00:00+09:00",
    endAt: "2026-08-08T14:00:00+09:00",
    visibleCategoryIds: [],
    authorId: "user-02",
    createdAt: "2026-07-20T09:00:00+09:00",
    updatedAt: "2026-07-20T09:00:00+09:00",
  },
  {
    eventId: "evt-03",
    title: "保護者面談週間",
    description: "対象は契約職員の方のみです。",
    categoryId: "cc-event",
    startAt: "2026-08-12T09:00:00+09:00",
    endAt: "2026-08-14T17:00:00+09:00",
    visibleCategoryIds: ["cat-contract"],
    authorId: "user-01",
    createdAt: "2026-07-20T09:00:00+09:00",
    updatedAt: "2026-07-20T09:00:00+09:00",
  },
  {
    eventId: "evt-04",
    title: "運動会",
    categoryId: "cc-event",
    startAt: "2026-09-20T09:00:00+09:00",
    endAt: "2026-09-20T13:00:00+09:00",
    visibleCategoryIds: [],
    authorId: "user-01",
    createdAt: "2026-07-15T09:00:00+09:00",
    updatedAt: "2026-07-15T09:00:00+09:00",
  },
];

export const mockDutyTypes: DutyType[] = [
  { dutyTypeId: "duty-hayade", name: "早出", isActive: true },
  { dutyTypeId: "duty-nitchoku", name: "日直", isActive: true },
  { dutyTypeId: "duty-1f-mimamori", name: "1F見守", isActive: true },
  { dutyTypeId: "duty-2f-mimamori", name: "2F見守", isActive: true },
  { dutyTypeId: "duty-genkan", name: "玄関受入", isActive: true },
];

export const mockShiftTypes: ShiftType[] = [
  { shiftTypeId: "shift-early", name: "早番", isActive: true },
  { shiftTypeId: "shift-late", name: "遅番", isActive: true },
  { shiftTypeId: "shift-day", name: "日勤", isActive: true },
];

/** 休日・当番・シフトのメンバー別・日別記録（管理者=manageShifts権限を持つ人のみ編集） */
export const mockMemberDailyStatuses: MemberDailyStatus[] = [
  {
    date: "2026-08-04",
    userId: "user-04",
    leaveType: "FULL",
    leaveReason: "ASSIGNED",
    updatedAt: "2026-07-20T09:00:00+09:00",
    updatedBy: "user-01",
  },
  {
    date: "2026-08-05",
    userId: "user-05",
    leaveType: "AM",
    leaveReason: "REQUESTED",
    updatedAt: "2026-07-25T09:00:00+09:00",
    updatedBy: "user-01",
  },
  {
    date: "2026-08-05",
    userId: "user-06",
    amShiftTypeId: "shift-early",
    leaveType: "PM",
    leaveReason: "REQUESTED",
    updatedAt: "2026-07-25T09:00:00+09:00",
    updatedBy: "user-01",
  },
  {
    date: "2026-08-05",
    userId: "user-07",
    amShiftTypeId: "shift-day",
    pmShiftTypeId: "shift-day",
    dutyTypeIds: ["duty-nitchoku"],
    updatedAt: "2026-07-25T09:00:00+09:00",
    updatedBy: "user-02",
  },
  {
    date: "2026-08-05",
    userId: "user-08",
    amShiftTypeId: "shift-day",
    pmShiftTypeId: "shift-day",
    dutyTypeIds: ["duty-1f-mimamori"],
    updatedAt: "2026-07-25T09:00:00+09:00",
    updatedBy: "user-02",
  },
  {
    date: "2026-08-05",
    userId: "user-09",
    amShiftTypeId: "shift-day",
    pmShiftTypeId: "shift-day",
    dutyTypeIds: ["duty-1f-mimamori"],
    updatedAt: "2026-07-25T09:00:00+09:00",
    updatedBy: "user-02",
  },
];

/** 日付単位（メンバーに紐づかない）の自由メモ。manageShifts権限を持つ人のみ編集可 */
export const mockDailyNotes: DailyNote[] = [
  {
    date: "2026-08-05",
    note: "10:00〜避難訓練あり。園庭に集合。",
    updatedAt: "2026-08-01T09:00:00+09:00",
    updatedBy: "user-01",
  },
];

export const mockOrgLinks: OrgLink[] = [
  {
    linkId: "link-01",
    title: "休暇申請フォーム",
    url: "https://forms.google.com/example-leave-request",
    category: "申請",
    sortOrder: 1,
    createdBy: "user-01",
    updatedAt: "2026-06-01T09:00:00+09:00",
  },
  {
    linkId: "link-02",
    title: "備品購入申請フォーム",
    url: "https://forms.google.com/example-purchase-request",
    category: "申請",
    sortOrder: 2,
    createdBy: "user-01",
    updatedAt: "2026-06-01T09:00:00+09:00",
  },
  {
    linkId: "link-03",
    title: "夏祭りボランティア募集フォーム",
    url: "https://forms.google.com/example-volunteer",
    category: "申請",
    sortOrder: 3,
    createdBy: "user-02",
    updatedAt: "2026-07-28T10:00:00+09:00",
  },
  {
    linkId: "link-04",
    title: "勤怠管理システム",
    url: "https://example-attendance-system.com",
    category: "業務システム",
    sortOrder: 4,
    createdBy: "user-01",
    updatedAt: "2026-05-01T09:00:00+09:00",
  },
  {
    linkId: "link-05",
    title: "給食献立表",
    url: "https://example-kitchen.com/menu",
    category: "資料",
    sortOrder: 5,
    createdBy: "user-02",
    updatedAt: "2026-05-01T09:00:00+09:00",
  },
];
