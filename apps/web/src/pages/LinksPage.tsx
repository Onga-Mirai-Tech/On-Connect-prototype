import { ExternalLink } from "lucide-react";
import { mockOrgLinks } from "@on-connect/shared";
import { colors } from "../theme/colors";

/** リンク集画面（7章 9番）：カテゴリー別一覧、タップで外部サイトを開く（5.5） */
export function LinksPage() {
  // TODO: GET /org-links から取得する（現状はダミーデータ表示）
  const links = [...mockOrgLinks].sort((a, b) => a.sortOrder - b.sortOrder);
  const categories = Array.from(new Set(links.map((l) => l.category ?? "その他")));

  return (
    <div>
      <h2>外部リンク集</h2>
      {links.length === 0 && <p>リンクは登録されていません。</p>}
      {categories.map((category) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, color: colors.textMuted }}>{category}</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {links
              .filter((l) => (l.category ?? "その他") === category)
              .map((link) => (
                <li key={link.linkId} style={{ padding: "8px 0" }}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <ExternalLink size={16} />
                    {link.title}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
