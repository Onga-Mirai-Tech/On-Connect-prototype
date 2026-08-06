import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Users, CalendarClock, Link2, Settings, ShieldCheck, ChevronRight, LogOut } from "lucide-react";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";

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
  const { currentUser, signOut } = useAuth();
  const navigate = useNavigate();
  const isAdmin = currentUser?.permissions.manageUsers ?? false;
  const items = isAdmin ? [...menuItems, adminMenuItem] : menuItems;

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

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
      <button
        type="button"
        onClick={handleSignOut}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 16,
          padding: "10px 16px",
          background: "transparent",
          border: `1px solid ${colors.surface}`,
          borderRadius: 12,
          color: colors.danger,
        }}
      >
        <LogOut size={16} /> サインアウト
      </button>
    </div>
  );
}
