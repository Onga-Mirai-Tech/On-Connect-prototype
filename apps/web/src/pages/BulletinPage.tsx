import { Link } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { mockBulletinPosts } from "@on-connect/shared";
import { colors } from "../theme/colors";

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
  const [category, setCategory] = useState<string>("すべて");
  const [query, setQuery] = useState("");
  const categories = ["すべて", "お知らせ", "行事", "緊急連絡"];
  const posts = [...mockBulletinPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredPosts = posts
    .filter((p) => category === "すべて" || p.category === category)
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
        {categories.map((c) => (
          <button key={c} onClick={() => setCategory(c)} disabled={c === category}>
            {c}
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
                {p.category === "緊急連絡" && <AlertTriangle size={12} color={colors.danger} />}
                <span>{p.category}</span>
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
