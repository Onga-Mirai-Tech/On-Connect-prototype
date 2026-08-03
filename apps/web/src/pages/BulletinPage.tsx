import { Link } from "react-router-dom";
import { useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { mockBulletinPosts } from "@on-connect/shared";
import { colors } from "../theme/colors";

/**
 * 掲示板一覧・詳細画面（7章 6番）：カテゴリー別フィルター（5.3.1）＋本文検索
 * TODO: GET /bulletin-posts にサーバーサイド検索を実装する（現状はクライアント側フィルタ）。
 */
export function BulletinPage() {
  const [category, setCategory] = useState<string>("すべて");
  const [query, setQuery] = useState("");
  const categories = ["すべて", "お知らせ", "行事", "緊急連絡"];
  const posts = [...mockBulletinPosts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filteredPosts = posts
    .filter((p) => category === "すべて" || p.category === category)
    .filter((p) => p.body.toLowerCase().includes(query.toLowerCase()));

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
          placeholder="本文を検索"
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
            <li key={p.postId} style={{ padding: "10px 0", borderBottom: `1px solid ${colors.surface}` }}>
              <Link to={`/bulletin/${p.postId}/edit`} style={{ display: "block" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: colors.textMuted }}>
                  {p.category === "緊急連絡" && <AlertTriangle size={12} color={colors.danger} />}
                  <span>{p.category}</span>
                  <span>・{p.createdAt.slice(0, 10)}</span>
                  {p.visibleCategoryIds.length > 0 && <span>・公開範囲限定</span>}
                </div>
                <div style={{ color: colors.text }}>{p.body}</div>
              </Link>
            </li>
          ))}
      </ul>
    </div>
  );
}
