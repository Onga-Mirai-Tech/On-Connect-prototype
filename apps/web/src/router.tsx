import { createBrowserRouter } from "react-router-dom";
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

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
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
    ],
  },
]);
