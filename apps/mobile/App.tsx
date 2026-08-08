import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./src/amplifyConfig";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { NotificationStatusProvider } from "./src/context/NotificationStatusContext";
import { OrgDataProvider } from "./src/context/OrgDataContext";

// フォアグラウンド時にも通知バナーを表示する（Phase 13、指定しないとフォアグラウンド受信時は無反応になる）
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Amplifyがセッションを解決するまでの間、ナビゲーションを開始しない（未ログイン判定のちらつき防止） */
function AppContent() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }
  return (
    <OrgDataProvider>
      <NotificationStatusProvider>
        <AppNavigator />
        <StatusBar style="auto" />
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
