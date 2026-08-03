import { StatusBar } from "expo-status-bar";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { NotificationStatusProvider } from "./src/context/NotificationStatusContext";

export default function App() {
  return (
    <NotificationStatusProvider>
      <AppNavigator />
      <StatusBar style="auto" />
    </NotificationStatusProvider>
  );
}
