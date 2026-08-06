import { RouterProvider } from "react-router-dom";
import { router } from "./router";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationStatusProvider } from "./context/NotificationStatusContext";

/** Amplifyがセッションを解決するまでの間、ルーティングを開始しない（未ログイン判定のちらつき防止） */
function AppContent() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }} />;
  }
  return (
    <NotificationStatusProvider>
      <RouterProvider router={router} />
    </NotificationStatusProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
