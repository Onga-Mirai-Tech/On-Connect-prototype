import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { mockBulletinPosts } from "@on-connect/shared";
import { HtmlEditor } from "../components/HtmlEditor";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";
import { colors } from "../theme/colors";

/**
 * 掲示板投稿・編集画面（7章 7番）
 * 「タイトル」「本文（HTML編集対応）」「添付ファイル」の構成、閲覧対象のメンバーカテゴリを選択（5.3.3）
 * Phase 8c：投稿本体をAPIに接続（コメント・リアクションはPhase 9のまま対象外）
 */
export function BulletinEditPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { memberCategories, bulletinCategories } = useOrgData();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [visibleCategoryIds, setVisibleCategoryIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!postId) {
      setCategoryId(bulletinCategories[0]?.categoryId ?? "");
      return;
    }
    (async () => {
      try {
        const post = await orgApi.getBulletinPost(postId);
        setTitle(post.title);
        setBody(post.body);
        setCategoryId(post.categoryId ?? bulletinCategories[0]?.categoryId ?? "");
        setVisibleCategoryIds(post.visibleCategoryIds);
      } catch {
        const post = mockBulletinPosts.find((p) => p.postId === postId);
        setTitle(post?.title ?? "");
        setBody(post?.body ?? "");
        setCategoryId(post?.categoryId ?? bulletinCategories[0]?.categoryId ?? "");
        setVisibleCategoryIds(post?.visibleCategoryIds ?? []);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, [postId]);

  const toggleVisibleCategory = (categoryId: string) => {
    setVisibleCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId],
    );
  };

  const handleSave = async () => {
    setError("");
    setSaving(true);
    try {
      const input = { title, body, categoryId: categoryId || undefined, visibleCategoryIds };
      if (postId) {
        await orgApi.updateBulletinPost(postId, input);
        navigate(`/bulletin/${postId}`);
      } else {
        const post = await orgApi.createBulletinPost(input);
        navigate(`/bulletin/${post.postId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "投稿の保存に失敗しました");
    } finally {
      setSaving(false);
    }
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
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {bulletinCategories.map((c) => (
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
        {memberCategories.map((c) => (
          <label key={c.categoryId} style={{ display: "block" }}>
            <input
              type="checkbox"
              checked={visibleCategoryIds.includes(c.categoryId)}
              onChange={() => toggleVisibleCategory(c.categoryId)}
            />
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
      {error && <p style={{ color: colors.danger, fontSize: 13 }}>{error}</p>}
      <button type="button" onClick={handleSave} disabled={saving} style={{ marginTop: 12 }}>
        保存
      </button>
    </div>
  );
}
