import { useParams } from "react-router-dom";
import { mockBulletinPosts, mockMemberCategories } from "@on-connect/shared";

/** 掲示板投稿・編集画面（7章 7番）：閲覧対象のメンバーカテゴリを選択（5.3.3） */
export function BulletinEditPage() {
  const { postId } = useParams();
  // TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ）
  const existingPost = postId ? mockBulletinPosts.find((p) => p.postId === postId) : undefined;

  return (
    <div>
      <h2>{postId ? "掲示板編集" : "新規投稿"}</h2>
      <label>
        カテゴリー：
        <select defaultValue={existingPost?.category ?? "お知らせ"}>
          <option>お知らせ</option>
          <option>行事</option>
          <option>緊急連絡</option>
        </select>
      </label>
      <textarea placeholder="本文" rows={8} defaultValue={existingPost?.body} />
      <div>
        <h3>閲覧可能なメンバーカテゴリ（未選択なら全体公開）</h3>
        {mockMemberCategories.map((c) => (
          <label key={c.categoryId} style={{ display: "block" }}>
            <input type="checkbox" defaultChecked={existingPost?.visibleCategoryIds.includes(c.categoryId)} />
            {c.name}
          </label>
        ))}
      </div>
      <div>
        <label>
          添付ファイル：
          <input type="file" multiple />
        </label>
      </div>
      <button type="button">保存</button>
    </div>
  );
}
