/**
 * 職員カテゴリー単位の閲覧権限フィルタ（設計書5.3.3）。
 * 空配列(=全体公開)、または閲覧者のmemberCategoryIdが含まれる場合に閲覧可能とする。
 * BulletinPost/CalendarEventの両方で共通利用する。
 */
export function isVisibleToCategory(visibleCategoryIds: string[], memberCategoryId: string): boolean {
  return visibleCategoryIds.length === 0 || visibleCategoryIds.includes(memberCategoryId);
}
