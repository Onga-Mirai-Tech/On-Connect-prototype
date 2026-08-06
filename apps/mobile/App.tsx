import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./src/amplifyConfig";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { NotificationStatusProvider } from "./src/context/NotificationStatusContext";

/** Amplifyがセッションを解決するまでの間、ナビゲーションを開始しない（未ログイン判定のちらつき防止） */
function AppContent() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return <View style={{ flex: 1 }} />;
  }
  return (
    <NotificationStatusProvider>
      <AppNavigator />
      <StatusBar style="auto" />
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
