import type {
  User,
  Role,
  MemberCategory,
  ChatRoom,
  Message,
  BulletinPost,
  OrgLink,
} from "./types";

/**
 * 機能デモ用のダミーデータ。
 * バックエンド（AWS）が未接続の段階でも、メンバー一覧・チャット・掲示板・
 * リンク集の見え方を確認できるようにするためのモックであり、実データではない。
 * `apps/web` `apps/mobile` の各ページから直接importして表示に使う。
 * カレンダー機能は廃止し、リンク集からGoogleカレンダーのURLへ直接遷移する方式に変更した。
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
  {
    roleId: "role-admin",
    name: "管理者",
    permissions: {
      manageUsers: true,
      sendForceNotify: true,
      manageBulletinCategories: true,
      manageOrgLinks: true,
      manageRoles: true,
      manageMemberCategories: true,
    },
  },
  {
    roleId: "role-general",
    name: "一般メンバー",
    permissions: {
      manageUsers: false,
      sendForceNotify: false,
      manageBulletinCategories: false,
      manageOrgLinks: false,
      manageRoles: false,
      manageMemberCategories: false,
    },
  },
];

export const mockMembers: User[] = [
  {
    userId: "user-01",
    displayName: "佐藤 陽子",
    furigana: "さとう ようこ",
    email: "sato@on-connect.example.com",
    roleId: "role-admin",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
  },
  {
    userId: "user-02",
    displayName: "高橋 誠",
    furigana: "たかはし まこと",
    email: "takahashi@on-connect.example.com",
    roleId: "role-admin",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
  },
  {
    userId: "user-03",
    displayName: "田中 美咲",
    furigana: "たなか みさき",
    email: "tanaka@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
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
  },
  {
    userId: "user-08",
    displayName: "中村 恵子",
    furigana: "なかむら けいこ",
    email: "nakamura@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-external",
    notificationStatus: "OFF",
  },
  {
    userId: "user-09",
    displayName: "小林 直樹",
    furigana: "こばやし なおき",
    email: "kobayashi@on-connect.example.com",
    roleId: "role-general",
    memberCategoryId: "cat-regular",
    notificationStatus: "ON",
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
 * 本来はCognito認証後にRolesテーブルのpermissionsを参照して判定するが、
 * 認証未実装の現段階ではダミーデータから算出する（管理者タブの表示制御に使用）。
 */
export const mockCurrentUserIsAdmin = (() => {
  const currentMember = mockMembers.find((m) => m.userId === mockCurrentUserId);
  const role = mockRoles.find((r) => r.roleId === currentMember?.roleId);
  return role?.permissions.manageUsers ?? false;
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
    name: "ひまわり組連絡",
    memberUserIds: ["user-01", "user-03", "user-05", "user-06"],
    createdAt: "2026-06-01T09:00:00+09:00",
  },
  {
    roomId: "room-group-all",
    isGroup: true,
    name: "全体連絡",
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

export const mockBulletinPosts: BulletinPost[] = [
  {
    postId: "post-01",
    category: "緊急連絡",
    body: "台風接近に伴い、明日8/4（火）は臨時休園といたします。今後の予定は追ってご連絡します。",
    authorId: "user-01",
    visibleCategoryIds: [],
    createdAt: "2026-08-03T20:00:00+09:00",
    updatedAt: "2026-08-03T20:00:00+09:00",
  },
  {
    postId: "post-02",
    category: "行事",
    body: "8/8（土）に夏祭りを開催します。ボランティアメンバーを募集していますので、参加可能な方はリンク集のフォームよりご回答ください。",
    authorId: "user-02",
    visibleCategoryIds: [],
    createdAt: "2026-07-28T10:00:00+09:00",
    updatedAt: "2026-07-28T10:00:00+09:00",
  },
  {
    postId: "post-03",
    category: "お知らせ",
    body: "契約更新に関する面談を8月中に実施します。対象の方には別途日程調整のご連絡をします。",
    authorId: "user-01",
    visibleCategoryIds: ["cat-contract"],
    createdAt: "2026-07-25T13:00:00+09:00",
    updatedAt: "2026-07-25T13:00:00+09:00",
  },
  {
    postId: "post-04",
    category: "お知らせ",
    body: "定例会議の議事録を共有します。次回は8/5（水）17:30〜です。",
    authorId: "user-02",
    visibleCategoryIds: ["cat-regular", "cat-contract"],
    createdAt: "2026-07-29T18:00:00+09:00",
    updatedAt: "2026-07-29T18:00:00+09:00",
  },
  {
    postId: "post-05",
    category: "行事",
    body: "運動会は9/20（日）を予定しています。会場設営の詳細は追ってお知らせします。",
    authorId: "user-01",
    visibleCategoryIds: [],
    createdAt: "2026-07-15T09:00:00+09:00",
    updatedAt: "2026-07-15T09:00:00+09:00",
  },
];

export const mockOrgLinks: OrgLink[] = [
  {
    linkId: "link-00",
    title: "園の共有カレンダー",
    url: "https://calendar.google.com/calendar/embed?src=kindergarten-shared%40group.calendar.google.com",
    category: "カレンダー",
    sortOrder: 0,
    createdBy: "user-01",
    updatedAt: "2026-08-03T09:00:00+09:00",
  },
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
