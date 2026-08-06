import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationStatusProvider } from "./context/NotificationStatusContext";
import { OrgDataProvider } from "./context/OrgDataContext";

/** Amplifyがセッションを解決するまでの間、ルーティングを開始しない（未ログイン判定のちらつき防止） */
function AppContent() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }} />;
  }
  return (
    <OrgDataProvider>
      <NotificationStatusProvider>
        <RouterProvider router={router} />
      </NotificationStatusProvider>
    </OrgDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
