import { NavigationContainer, createNavigationContainerRef, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, type ComponentProps } from "react";

import { LoginScreen } from "../screens/LoginScreen";
import { ChatListScreen } from "../screens/ChatListScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { NewDirectMessageScreen } from "../screens/NewDirectMessageScreen";
import { GroupChatCreateScreen } from "../screens/GroupChatCreateScreen";
import { MembersScreen } from "../screens/MembersScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { BulletinScreen } from "../screens/BulletinScreen";
import { BulletinDetailScreen } from "../screens/BulletinDetailScreen";
import { BulletinEditScreen } from "../screens/BulletinEditScreen";
import { CalendarScreen } from "../screens/CalendarScreen";
import { CalendarEventEditScreen } from "../screens/CalendarEventEditScreen";
import { CalendarDetailScreen } from "../screens/CalendarDetailScreen";
import { LinksScreen } from "../screens/LinksScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { ShiftManagementScreen } from "../screens/ShiftManagementScreen";
import { MenuScreen } from "../screens/MenuScreen";
import { HeaderStatus } from "./HeaderStatus";
import { colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { callClient } from "../api/callClient";

export type ChatStackParamList = {
  ChatList: undefined;
  ChatRoom: { roomId: string };
  NewDirectMessage: undefined;
  GroupChatCreate: undefined;
};

export type BulletinStackParamList = {
  BulletinList: undefined;
  BulletinDetail: { postId: string };
  BulletinEdit: { postId?: string };
};

export type CalendarStackParamList = {
  CalendarList: undefined;
  CalendarDetail: { eventId: string };
  CalendarEventEdit: { eventId?: string };
};

// 管理者機能はブラウザ版（apps/web）のみで提供し、モバイル版にはタブを設けない。
// メンバー一覧・シフト管理・リンク集・個人設定は下部タブから溢れるため、メニュータブ配下にまとめる（Phase 4）。
export type MenuStackParamList = {
  MenuHome: undefined;
  Members: undefined;
  ShiftManagement: undefined;
  Links: undefined;
  Settings: undefined;
};

export type HomeTabParamList = {
  ChatTab: NavigatorScreenParams<ChatStackParamList> | undefined;
  BulletinTab: NavigatorScreenParams<BulletinStackParamList> | undefined;
  Calendar: NavigatorScreenParams<CalendarStackParamList> | undefined;
  MenuTab: NavigatorScreenParams<MenuStackParamList> | undefined;
};

/**
 * 通話画面（Phase 11）へのパラメータ。Web版のCallLocationState（apps/web/src/pages/IncomingCallPage.tsx）
 * と同じ役割分担だが、meeting/attendeeはchime-audio-callネイティブモジュールへ渡すJSON文字列として保持する
 * （発信側もPOST /calls応答をJSON.stringifyしてから渡す。apps/mobile/src/api/callClient.ts参照）。
 */
export type CallRouteParams =
  | {
      role: "caller";
      callId: string;
      calleeId: string;
      calleeName: string;
      meetingJson: string;
      attendeeJson: string;
      startTime: string;
    }
  | {
      role: "callee";
      callId: string;
      callerId: string;
      callerName: string;
      meetingJson: string;
      calleeAttendeeJson: string;
      startTime: string;
    };

export type RootStackParamList = {
  Login: undefined;
  Home: NavigatorScreenParams<HomeTabParamList> | undefined;
  IncomingCall: CallRouteParams;
};

type IoniconName = ComponentProps<typeof Ionicons>["name"];

const tabIcons: Record<keyof HomeTabParamList, IoniconName> = {
  ChatTab: "chatbubbles-outline",
  BulletinTab: "clipboard-outline",
  Calendar: "calendar-outline",
  MenuTab: "menu-outline",
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const HomeTab = createBottomTabNavigator<HomeTabParamList>();
const ChatStack = createNativeStackNavigator<ChatStackParamList>();
const BulletinStack = createNativeStackNavigator<BulletinStackParamList>();
const CalendarStack = createNativeStackNavigator<CalendarStackParamList>();
const MenuStack = createNativeStackNavigator<MenuStackParamList>();

function ChatStackNavigator() {
  return (
    <ChatStack.Navigator>
      <ChatStack.Screen
        name="ChatList"
        component={ChatListScreen}
        options={{ title: "チャット", headerLeft: () => <HeaderStatus /> }}
      />
      <ChatStack.Screen name="ChatRoom" component={ChatRoomScreen} options={{ title: "" }} />
      <ChatStack.Screen
        name="NewDirectMessage"
        component={NewDirectMessageScreen}
        options={{ title: "個別メッセージ" }}
      />
      <ChatStack.Screen
        name="GroupChatCreate"
        component={GroupChatCreateScreen}
        options={{ title: "グループ作成" }}
      />
    </ChatStack.Navigator>
  );
}

function BulletinStackNavigator() {
  return (
    <BulletinStack.Navigator>
      <BulletinStack.Screen
        name="BulletinList"
        component={BulletinScreen}
        options={{ title: "掲示板", headerLeft: () => <HeaderStatus /> }}
      />
      <BulletinStack.Screen name="BulletinDetail" component={BulletinDetailScreen} options={{ title: "" }} />
      <BulletinStack.Screen name="BulletinEdit" component={BulletinEditScreen} options={{ title: "投稿" }} />
    </BulletinStack.Navigator>
  );
}

function CalendarStackNavigator() {
  return (
    <CalendarStack.Navigator>
      <CalendarStack.Screen
        name="CalendarList"
        component={CalendarScreen}
        options={{ title: "カレンダー", headerLeft: () => <HeaderStatus /> }}
      />
      <CalendarStack.Screen name="CalendarDetail" component={CalendarDetailScreen} options={{ title: "" }} />
      <CalendarStack.Screen
        name="CalendarEventEdit"
        component={CalendarEventEditScreen}
        options={{ title: "予定" }}
      />
    </CalendarStack.Navigator>
  );
}

function MenuStackNavigator() {
  return (
    <MenuStack.Navigator>
      <MenuStack.Screen
        name="MenuHome"
        component={MenuScreen}
        options={{ title: "メニュー", headerLeft: () => <HeaderStatus /> }}
      />
      <MenuStack.Screen name="Members" component={MembersScreen} options={{ title: "メンバー" }} />
      <MenuStack.Screen name="ShiftManagement" component={ShiftManagementScreen} options={{ title: "シフト管理" }} />
      <MenuStack.Screen name="Links" component={LinksScreen} options={{ title: "リンク集" }} />
      <MenuStack.Screen name="Settings" component={SettingsScreen} options={{ title: "個人設定" }} />
    </MenuStack.Navigator>
  );
}

/** ホーム画面（Phase 4）：チャット／掲示板／カレンダー／メニューの4タブ構成。
 * メンバー一覧・シフト管理・リンク集・個人設定はメニュータブ配下にまとめる。 */
function HomeTabs() {
  return (
    <HomeTab.Navigator
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: colors.brandDark,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={tabIcons[route.name]} color={color} size={size} />
        ),
        headerLeft: () => <HeaderStatus />,
      })}
    >
      <HomeTab.Screen name="ChatTab" component={ChatStackNavigator} options={{ title: "チャット", headerShown: false }} />
      <HomeTab.Screen name="BulletinTab" component={BulletinStackNavigator} options={{ title: "掲示板", headerShown: false }} />
      <HomeTab.Screen name="Calendar" component={CalendarStackNavigator} options={{ title: "カレンダー", headerShown: false }} />
      <HomeTab.Screen name="MenuTab" component={MenuStackNavigator} options={{ title: "メニュー", headerShown: false }} />
    </HomeTab.Navigator>
  );
}

/** ルート未使用時（NavigationContainerの外）からも画面遷移できるよう、着信リスナー用に公開する（Phase 11）。 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * 未ログイン時はLogin画面のみ、ログイン中はHome/IncomingCallのみを登録する（Phase 8a）。
 * サインイン成功でAuthContextのcurrentUserIdが更新されると、この分岐が自動的に切り替わる。
 * ログイン中は常時onIncomingCallを購読し、着信を受けたらどの画面を見ていても着信画面へ切り替える
 * （Phase 11、Web版のrouter.tsxのRequireAuthと同じ役割）。
 */
export function AppNavigator() {
  const { currentUserId } = useAuth();

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = callClient.subscribeToIncomingCalls(currentUserId, (call) => {
      if (!navigationRef.isReady()) return;
      navigationRef.navigate("IncomingCall", {
        role: "callee",
        callId: call.callId,
        callerId: call.callerId,
        callerName: call.callerName,
        meetingJson: call.meetingJson,
        calleeAttendeeJson: call.calleeAttendeeJson,
        startTime: new Date().toISOString(),
      });
    });
    return unsubscribe;
  }, [currentUserId]);

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {currentUserId ? (
          <>
            <RootStack.Screen name="Home" component={HomeTabs} />
            <RootStack.Screen
              name="IncomingCall"
              component={IncomingCallScreen}
              options={{ presentation: "fullScreenModal" }}
            />
          </>
        ) : (
          <RootStack.Screen name="Login" component={LoginScreen} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
