import { NavLink, Outlet } from "react-router-dom";
import { MessageCircle, ClipboardList, CalendarDays, Menu, Bell, BellOff } from "lucide-react";
import { mockMembers, mockCurrentUserId } from "@on-connect/shared";
import { colors } from "../theme/colors";
import { useNotificationStatus } from "../context/NotificationStatusContext";

const currentMember = mockMembers.find((m) => m.userId === mockCurrentUserId);

const navItems = [
  { to: "/chat", label: "チャット", icon: MessageCircle },
  { to: "/bulletin", label: "掲示板", icon: ClipboardList },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays },
  { to: "/menu", label: "メニュー", icon: Menu },
];

/**
 * ホーム画面（Phase 4）：チャット／掲示板／カレンダー／メニューの4タブ構成。
 * メンバー一覧・シフト管理・リンク集・個人設定・管理者設定はメニュー画面（MenuPage）から遷移する。
 * 下部タブバーは position: fixed でスクロールに追従させ、常に画面内に表示する。
 */
export function HomeLayout() {
  const { status } = useNotificationStatus();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          background: colors.brand,
        }}
      >
        <img src="/icon-192.png" alt="" width={28} height={28} style={{ borderRadius: 8 }} />
        <span style={{ fontWeight: 700 }}>On-Connect</span>
        <span style={{ width: 1, alignSelf: "stretch", background: "rgba(0,0,0,0.15)" }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 14 }}>
          <span style={{ fontWeight: 600 }}>{currentMember?.displayName ?? "ゲスト"}</span>
          {status === "ON" ? (
            <span style={{ display: "flex", alignItems: "center", gap: 2, color: "#1A1A1A" }}>
              <Bell size={14} /> 通知ON
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 2, color: "#5B6B66" }}>
              <BellOff size={14} /> 通知OFF
            </span>
          )}
        </span>
      </header>
      <main style={{ flex: 1, padding: 16, paddingBottom: 96 }}>
        <Outlet />
      </main>
      <nav
        style={{
          display: "flex",
          justifyContent: "space-around",
          borderTop: `1px solid ${colors.surface}`,
          padding: "8px 0",
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: colors.background,
          zIndex: 10,
        }}
      >
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              textDecoration: "none",
              color: isActive ? colors.brandDark : colors.textMuted,
              fontWeight: isActive ? 700 : 400,
              fontSize: 12,
            })}
          >
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
