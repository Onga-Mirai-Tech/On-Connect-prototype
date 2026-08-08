import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { orgApi } from "./orgApi";

/**
 * Expo Push Notification Serviceのトークンを取得し、バックエンドへ登録する（Phase 13）。
 * 通知許可が無い・シミュレータ等でトークンが取得できない・API未接続等、あらゆる失敗を静かに諦める
 * （他のAPI呼び出しと同じフォールバック方針。プッシュ通知はおまけ機能であり、失敗してもログインや
 * アプリの利用自体は妨げない）。
 */
export async function registerForPushNotificationsAsync(userId: string): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const permission = await Notifications.requestPermissionsAsync();
    if (permission.status !== "granted") return;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;

    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
    await orgApi.updatePushToken(userId, expoPushToken);
  } catch {
    // トークン取得・登録に失敗しても致命的ではないため無視する
  }
}
