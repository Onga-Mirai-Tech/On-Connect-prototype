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
import { BulletinEditPage } from "./pages/BulletinEditPage";
import { LinksPage } from "./pages/LinksPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminPage } from "./pages/AdminPage";

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
      { path: "bulletin/:postId/edit", element: <BulletinEditPage /> },
      { path: "links", element: <LinksPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "admin", element: <AdminPage /> },
    ],
  },
]);
