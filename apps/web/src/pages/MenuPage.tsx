import { Link } from "react-router-dom";
import { Users, CalendarClock, Link2, Settings, ShieldCheck, ChevronRight } from "lucide-react";
import { mockCurrentUserIsAdmin } from "@on-connect/shared";
import { colors } from "../theme/colors";

const menuItems = [
  { to: "/members", label: "メンバー", icon: Users },
  { to: "/shift-management", label: "シフト管理", icon: CalendarClock },
  { to: "/links", label: "リンク集", icon: Link2 },
  { to: "/settings", label: "個人設定", icon: Settings },
];

const adminMenuItem = { to: "/admin", label: "管理者設定", icon: ShieldCheck };

/**
 * メニュー画面（Phase 4）：下部タブから溢れたメンバー一覧・シフト管理・リンク集・個人設定への導線。
 * 管理者設定は`manageUsers`権限を持つ人にのみ表示する。
 */
export function MenuPage() {
  const items = mockCurrentUserIsAdmin ? [...menuItems, adminMenuItem] : menuItems;

  return (
    <div>
      <h2>メニュー</h2>
      <div style={{ border: `1px solid ${colors.surface}`, borderRadius: 14, overflow: "hidden" }}>
        {items.map((item, i) => (
          <Link
            key={item.to}
            to={item.to}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              textDecoration: "none",
              color: colors.text,
              borderTop: i === 0 ? "none" : `1px solid ${colors.surface}`,
            }}
          >
            <item.icon size={18} color={colors.brandDark} />
            <span style={{ flex: 1, fontWeight: 600 }}>{item.label}</span>
            <ChevronRight size={16} color={colors.textMuted} />
          </Link>
        ))}
      </div>
    </div>
  );
}
