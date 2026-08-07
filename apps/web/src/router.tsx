import { useEffect } from "react";
import { createBrowserRouter, Navigate, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { callClient } from "./api/callClient";
import { HomeLayout } from "./pages/HomeLayout";
import { LoginPage } from "./pages/LoginPage";
import { ChatListPage } from "./pages/ChatListPage";
import { ChatRoomPage } from "./pages/ChatRoomPage";
import { NewDirectMessagePage } from "./pages/NewDirectMessagePage";
import { GroupChatCreatePage } from "./pages/GroupChatCreatePage";
import { MembersPage } from "./pages/MembersPage";
import { IncomingCallPage } from "./pages/IncomingCallPage";
import { BulletinPage } from "./pages/BulletinPage";
import { BulletinDetailPage } from "./pages/BulletinDetailPage";
import { BulletinEditPage } from "./pages/BulletinEditPage";
import { CalendarPage } from "./pages/CalendarPage";
import { CalendarEventEditPage } from "./pages/CalendarEventEditPage";
import { CalendarDetailPage } from "./pages/CalendarDetailPage";
import { LinksPage } from "./pages/LinksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";
import { ShiftManagementPage } from "./pages/ShiftManagementPage";
import { MenuPage } from "./pages/MenuPage";

/**
 * 未ログイン時は/loginへリダイレクトする（Phase 8a）。認証状態解決中はApp.tsx側でローディング表示するため、
 * ここではisLoadingを考慮しない。
 * ログイン中は常時onIncomingCallを購読し、着信を受けたら画面遷移する（Phase 11、どのページを見ていても
 * 着信画面へ切り替わる。専用のプロバイダファイルは作らずここに寄せる）。
 */
function RequireAuth() {
  const { currentUserId } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = callClient.subscribeToIncomingCalls(currentUserId, (call) => {
      navigate("/calls/incoming", {
        state: {
          role: "callee",
          callId: call.callId,
          callerId: call.callerId,
          callerName: call.callerName,
          meetingJson: call.meetingJson,
          calleeAttendeeJson: call.calleeAttendeeJson,
          startTime: new Date().toISOString(),
        },
      });
    });
    return unsubscribe;
  }, [currentUserId, navigate]);

  if (!currentUserId) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "/calls/incoming", element: <IncomingCallPage /> },
      {
        path: "/",
        element: <HomeLayout />,
        children: [
          { index: true, element: <ChatListPage /> },
          { path: "chat", element: <ChatListPage /> },
          { path: "chat/new-direct", element: <NewDirectMessagePage /> },
          { path: "chat/new-group", element: <GroupChatCreatePage /> },
          { path: "chat/:roomId", element: <ChatRoomPage /> },
          { path: "members", element: <MembersPage /> },
          { path: "bulletin", element: <BulletinPage /> },
          { path: "bulletin/new", element: <BulletinEditPage /> },
          { path: "bulletin/:postId", element: <BulletinDetailPage /> },
          { path: "bulletin/:postId/edit", element: <BulletinEditPage /> },
          { path: "calendar", element: <CalendarPage /> },
          { path: "calendar/new", element: <CalendarEventEditPage /> },
          { path: "calendar/:eventId", element: <CalendarDetailPage /> },
          { path: "calendar/:eventId/edit", element: <CalendarEventEditPage /> },
          { path: "shift-management", element: <ShiftManagementPage /> },
          { path: "links", element: <LinksPage /> },
          { path: "settings", element: <SettingsPage /> },
          { path: "admin", element: <AdminPage /> },
          { path: "menu", element: <MenuPage /> },
        ],
      },
    ],
  },
]);
