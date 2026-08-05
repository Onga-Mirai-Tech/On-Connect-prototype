import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockBulletinPosts, mockBulletinCategories, mockMemberCategories } from "@on-connect/shared";
import { HtmlEditor } from "../components/HtmlEditor";

/**
 * 掲示板投稿・編集画面（7章 7番）
 * 「タイトル」「本文（HTML編集対応）」「添付ファイル」の構成、閲覧対象のメンバーカテゴリを選択（5.3.3）
 * TODO: 保存処理をAPIに接続する（現状はダミーデータの表示のみ、保存は一覧に戻るだけ）
 */
export function BulletinEditPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const existingPost = postId ? mockBulletinPosts.find((p) => p.postId === postId) : undefined;

  const [title, setTitle] = useState(existingPost?.title ?? "");
  const [body, setBody] = useState(existingPost?.body ?? "");

  const handleSave = () => {
    // TODO: POST/PUT /bulletin-posts を呼び出して保存する
    console.log("save bulletin post", { title, body });
    navigate(postId ? `/bulletin/${postId}` : "/bulletin");
  };

  return (
    <div>
      <h2>{postId ? "掲示板編集" : "新規投稿"}</h2>
      <label style={{ display: "block", marginBottom: 8 }}>
        タイトル
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例）夏祭り開催のお知らせ"
          style={{ display: "block", width: "100%", marginTop: 4 }}
        />
      </label>
      <label>
        カテゴリー：
        <select defaultValue={existingPost?.categoryId ?? mockBulletinCategories[0]?.categoryId}>
          {mockBulletinCategories.map((c) => (
            <option key={c.categoryId} value={c.categoryId}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div style={{ marginTop: 8 }}>
        <div style={{ marginBottom: 4 }}>本文</div>
        <HtmlEditor value={body} onChange={setBody} />
      </div>
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
      <button type="button" onClick={handleSave} style={{ marginTop: 12 }}>
        保存
      </button>
    </div>
  );
}
