/**
 * グループチャット作成画面（7章 4番）
 * メンバーカテゴリを指定してメンバーを一括選択できる補助機能を提供する（5.2.1）
 */
export function GroupChatCreatePage() {
  // TODO: MemberCategories一覧の取得、カテゴリ選択によるメンバー一括追加ロジック
  return (
    <div>
      <h2>グループチャット作成</h2>
      <label>
        グループ名：
        <input type="text" placeholder="例）3歳児クラス" />
      </label>
      <div>
        <h3>メンバーカテゴリから一括選択</h3>
        {/* TODO: MemberCategoriesのチェックボックス一覧 */}
      </div>
      <div>
        <h3>メンバー個別選択</h3>
        {/* TODO: Usersの検索・個別選択 */}
      </div>
      <button type="button">作成</button>
    </div>
  );
}
