import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { mockBulletinPosts, type BulletinPost } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useOrgData } from "../context/OrgDataContext";
import { orgApi } from "../api/orgApi";

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

const previewText = (html: string, maxLength = 90) => {
  const text = stripHtml(html);
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
};

/**
 * 掲示板一覧画面（7章 6番）：カテゴリー別フィルター（5.3.1）＋本文検索
 * タイトルを目立たせ、本文はHTMLタグを除いた冒頭数行をプレビュー表示する。
 * TODO: GET /bulletin-posts にサーバーサイド検索を実装する（現状はクライアント側フィルタ）。
 */
export function BulletinPage() {
  const { bulletinCategories } = useOrgData();
  const categoryName = (categoryId: string | undefined) =>
    bulletinCategories.find((c) => c.categoryId === categoryId)?.name;
  const [categoryId, setCategoryId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [rawPosts, setRawPosts] = useState<BulletinPost[]>(mockBulletinPosts);

  useEffect(() => {
    (async () => {
      try {
        setRawPosts(await orgApi.listBulletinPosts());
      } catch {
        setRawPosts(mockBulletinPosts);
      }
    })();
  }, []);

  const posts = [...rawPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredPosts = posts
    .filter((p) => categoryId === "all" || p.categoryId === categoryId)
    .filter((p) => {
      const q = query.toLowerCase();
      if (!q) return true;
      return p.title.toLowerCase().includes(q) || stripHtml(p.body).toLowerCase().includes(q);
    });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h2>掲示板</h2>
        <Link to="/bulletin/new">＋ 新規投稿</Link>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0" }}>
        <Search size={16} />
        <input
          type="text"
          placeholder="タイトル・本文を検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setCategoryId("all")} disabled={categoryId === "all"}>
          すべて
        </button>
        {bulletinCategories.map((c) => (
          <button key={c.categoryId} onClick={() => setCategoryId(c.categoryId)} disabled={c.categoryId === categoryId}>
            {c.name}
          </button>
        ))}
      </div>
      {filteredPosts.length === 0 && (
        <p>{query.trim() ? "一致する投稿が見つかりません。" : "投稿はまだありません。"}</p>
      )}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredPosts.map((p) => (
          <li key={p.postId} style={{ padding: "12px 0", borderBottom: `1px solid ${colors.surface}` }}>
            <Link to={`/bulletin/${p.postId}`} style={{ display: "block" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textMuted }}>
                {categoryName(p.categoryId) === "緊急連絡" && <AlertTriangle size={12} color={colors.danger} />}
                <span>{categoryName(p.categoryId)}</span>
                <span>・{p.createdAt.slice(0, 10)}</span>
                {p.visibleCategoryIds.length > 0 && <span>・公開範囲限定</span>}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: colors.text, marginTop: 2 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>{previewText(p.body)}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
